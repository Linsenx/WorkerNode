import Worker from '../BaseWorker'
import TcpConnection from '../Connections/Tcp'
import ISocket from '../Connectors/ISocket'
import * as nanoid from 'nanoid'
import { GATEWAY } from '../Utils/Constants';

class Gateway extends Worker {

  /**
  * 用户保持长连接的心跳时间间隔(MS)
   */
  static PING_INTERVAL = 25 * 1000

  /**
   * 本机IP
   */
  public lanIp: string = '127.0.0.1'

  /**
   * 本机端口
   */
  public lanPort: Number = 0

  /**
   * 注册服务器地址
   */
  public registerAddress: string

  /**
   * 保存客户端的所有 connection 对象
   */
  protected clientConnetctions: Map<String, ISocket>

  /**
   * 保存所有 worker 的内部连接的 connection 对象
   */
  protected workerConnections: Map<String, ISocket>
  
  /**
   * BusinessWorker 到 connection 的映射，一对多关系
   */
  protected groupConnections: Map<String, Map<String, ISocket>>

  /**
   * 用于内部通讯的 tcp 服务
   */
  protected innerTcpWorker: Worker

  constructor(socketName: string) {
    super(socketName)
    this.clientConnetctions = new Map<String, ISocket>()
    this.groupConnections = new Map<String, Map<String, ISocket>>()
    this.workerConnections = new Map<String, ISocket>()
  }

  run() {
    this.connectToRegister()

    this.on('workerStart', this.onWorkerStart.bind(this))
    // 当客户端连接网关时
    this.on('connection', this.onClientConnect.bind(this))
    // 当客户端断开连接时
    this.on('close', this.onClientClose.bind(this))
    // 当客户端发来数据时
    this.on('message', this.onClientMessage.bind(this))

    super.run()
  }

  onWorkerStart() {
    // 开启一个服务用于 gateway 与 businessWorker 的内部通讯
    this.innerTcpWorker = new Worker(`tcp://${this.lanIp}:${this.lanPort}`)
    this.innerTcpWorker.run()

    this.innerTcpWorker.on('message', this.onWorkerMessage.bind(this))
    this.innerTcpWorker.on('connection', this.onWorkerConnect.bind(this))
    this.innerTcpWorker.on('close', this.onWorkerClose.bind(this))
  }


  /**
   * 连接服务注册中心
   */
  connectToRegister(): void {
    if (this.registerAddress === '') {
      return
    }
    const connection = new TcpConnection(this.registerAddress)
    connection.on('connect', () => {
      connection.send(JSON.stringify({
        event: 'gateway_connect',
        address: `${this.lanIp}:${this.lanPort}`,
        secret_key: ""
      }))

      // 如果注册服务器不在本地，则需要保持心跳
      let pingTimer = undefined
      if (this.registerAddress.indexOf('127.0.0.1') === -1) {
        pingTimer = setInterval(() => {
          connection.send(`{"event": "ping"}`)
        }, Gateway.PING_INTERVAL)
      }

      connection.on('close', () => {
        if (pingTimer !== undefined) {
          clearInterval(pingTimer)
        }
        connection.reconnect(this.registerAddress)
      })

      connection.on('message', data => {
        console.log(data.toString())
      })      
    })
  }

  joinGroup(conn: ISocket, groupId: string) {
    const clientId = conn.session.clientId
    const clientConnection = this.clientConnetctions[clientId]
    // 若找不到相应id的用户，直接返回
    if (clientConnection === undefined) {
      return
    }
    if (!this.groupConnections[groupId]) {
      this.groupConnections[groupId] = new Map<String, ISocket>()
    }
    conn.session.groupId = groupId
    this.groupConnections[groupId][clientId] = clientConnection
  }

  /**
   * 当客户连接到 gateway 触发
   * @param conn 
   */
  onClientConnect(conn: ISocket) {
    conn.session.clientId = nanoid()
    conn.session.authorized = true // 是否通过验证
    conn.session.groupId = undefined
    this.clientConnetctions[conn.session.clientId] = conn
  }

  /**
   * 当客户向 gateway 发送数据时触发
   * @param conn 
   * @param message 
   */
  onClientMessage(conn: ISocket, message: ArrayBuffer) {
    if (conn.session.clientId === undefined || conn.session.authorized === false) {
      return
    }

    if (conn.session.groupId === undefined) {
      // 若用户未加入一个group，需要先加入
      try {
        const buffer = Buffer.from(message)
        const data = JSON.parse(buffer.toString())
        const event = data.event || 'undefined_event'
        if (event === 'join_group') {
          if (data.groupId !== undefined) {
            // 用户成功绑定到 worker
            this.joinGroup(conn, data.groupId)
            this.sendToWorker(GATEWAY.CMD_ON_CONNECT, conn.session.clientId, conn.session.groupId, Buffer.from(''))
          }
        }
      } catch (error) {
        console.log('Error:', error)
      }
    } else {
      // 将数据转发至相应businessWorker
      this.sendToWorker(GATEWAY.CMD_ON_MESSAGE, conn.session.clientId, conn.session.groupId, message)
    }
  }

  sendToWorker(cmd: number, clientId: string, groupId: string, message: ArrayBuffer) {
    if (this.workerConnections.has(groupId)) {
      const buf0 = Buffer.alloc(2)
      buf0.writeUInt16BE(cmd, 0)
      const buf1 = Buffer.from(clientId)
      const buf2 = Buffer.from(message)
      const buffer = Buffer.concat([buf0,buf1, buf2], buf0.length + buf1.length + buf2.length)
      this.workerConnections.get(groupId).send(buffer)
    }
  }

  /**
   * 当客户与 gateway 断开连接时触发
   * @param conn 
   * @param message 
   */
  onClientClose(conn: ISocket, message: any) {
    console.log(conn.session.clientId, 'close.......')
    this.sendToWorker(GATEWAY.CMD_ON_CLOSE, conn.session.clientId, conn.session.groupId, Buffer.from(''))
  }

  /**
   * 当 worker 连接到 gateway 时触发
   * @param conn 
   */
  onWorkerConnect(conn: ISocket) {
    
  }

  /**
   * 当 worker 断开与 gateway 的连接时触发
   * @param conn 
   */
  onWorkerClose(conn: ISocket) {
    if (conn.session.id !== undefined) {
      this.workerConnections.delete(conn.session.id)
    }
  }  

  /**
   * 当 worker 向 gateway 发送数据时触发
   * @param conn 
   * @param message 
   */
  onWorkerMessage(conn: ISocket, message: any) {
    try {
      const data = JSON.parse(message.toString())
      const cmd = data.cmd || -1
      // console.log(data)
      switch (cmd) {
        case GATEWAY.CMD_WORER_CONNECT:
          if (data.workerId !== undefined) {
            this.workerConnections.set(data.workerId, conn)
          }
          conn.session.id = data.workerId
          break
      
        case GATEWAY.CMD_WORKER_MESSAGE:
          if (data.clientId !== undefined && data.data !== undefined) {
            this.clientConnetctions[data.clientId].send(data.data)
          }
          break

        default:
          break
      }
    } catch (error) {
      console.log(error)
    }
  }

}

export default Gateway
import TcpConnection from '../Connections/Tcp'
import * as nanoid from 'nanoid'
import { EventEmitter } from 'events'
import { GATEWAY } from '../Utils/Constants'


declare interface BussinessWorker {
  on(event: string, listener: (...args: any[]) => void): this
  on(event: 'close', listener: (clientId: string) => void): this
  on(event: 'connection', listener: (clientId: string) => void): this
  on(event: 'message', listener: (clientId: string, message: Buffer) => void): this
  on(event: 'workerStart', listener: () => void): this
}

class BussinessWorker extends EventEmitter {

  /**
   * 用户保持长连接的心跳时间间隔(MS)
   */
  static PING_INTERVAL = 25 * 1000  

  /**
   * 该 Worker 的id
   */
  public workerId: string = ''

  /**
   * 注册服务器地址
   */
  public registerAddress: string

  /**
   * 已连接上的 Gateway 的地址
   */
  protected connectedGatewayAddresses: Set<string>

  /**
   * 保存与 gateway 的连接 connection 对象
   */
  protected gatewayConnections: Set<TcpConnection>

  constructor() {
    super()
    this.workerId = nanoid()
    this.gatewayConnections = new Set<TcpConnection>()
    this.connectedGatewayAddresses = new Set<string>()
    console.log(`{"event": "join_group", "groupId": "${this.workerId}"}`)
  }

  run() {
    this.connectToRegister()
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
        event: 'worker_connect',
        secret_key: ""
      }))
      // 如果注册服务器不在本地，则需要保持心跳
      let pingTimer = undefined
      if (this.registerAddress.indexOf('127.0.0.1') === -1) {
        pingTimer = setInterval(() => {
          connection.send(`{"event": "ping"}`)
        }, BussinessWorker.PING_INTERVAL)
      }

      connection.on('close', () => {
        if (pingTimer !== undefined) {
          clearInterval(pingTimer)
        }
        connection.reconnect(this.registerAddress)
      })

      connection.on('message', this.onRegisterMessage.bind(this))

      this.emit('workerStart')
    })
  }

  /**
   * 当注册中心发来消息时
   */
  onRegisterMessage(message: Buffer) {
    const data = JSON.parse(message.toString())
    const event = data.event || 'undefined_event'
    // console.log(data)
    switch (event) {
      case 'broadcast_addresses':
        if (data.addresses === undefined) {
          return
        }
        this.checkGatewayConnections(data.addresses)
        break

      default:
    }
  }

  /**
   * 检查 gateway 的通信端口是否都已经连通
   * 如果有未连接的端口，则尝试连接
   * @param addresses 
   */
  checkGatewayConnections(addresses: Array<string>) {
    addresses.forEach(address => {
      if (!this.connectedGatewayAddresses.has(address)) {
        this.tryToConnectGateway(address)
      }
    })
  }

  /**
   * 尝试连接到某个 gateway
   * @param address 
   */
  tryToConnectGateway(address: string) {
    if (!this.connectedGatewayAddresses.has(address)) {
      const gatewayConnection = new TcpConnection(address)
      gatewayConnection.on('connect', () => {
        // 向 gateway 发送 worker 的信息
        const workerData = JSON.stringify({
          cmd: GATEWAY.CMD_WORER_CONNECT,
          workerId: this.workerId
        })
        gatewayConnection.send(workerData)
        
        this.connectedGatewayAddresses.add(address)
        this.gatewayConnections.add(gatewayConnection)
      })
      gatewayConnection.on('close', () => {
        this.connectedGatewayAddresses.delete(address)
      })
      gatewayConnection.on('message', (data: Buffer) => {
        this.onGatewayMessage(gatewayConnection, data)
      })
    }
  }

  /**
   * 当接收到 gateway 的数据时触发
   * @param data 
   */
  onGatewayMessage(connection: TcpConnection, data: Buffer) {
    const cmd = data.slice(0, 2).readUInt16BE(0)
    const clientId = data.slice(2, 23).toString()
    const message = data.slice(23)

    switch (cmd) {
      case GATEWAY.CMD_ON_CONNECT:
        this.emit('connection', clientId)
        break
    
      case GATEWAY.CMD_ON_MESSAGE:
        this.emit('message', clientId, message)
        break

      case GATEWAY.CMD_ON_CLOSE:
        this.emit('close', clientId)
        break
    }
  }

  sendToCid(clientId: string, data: any) {
    this.gatewayConnections.forEach(gateway => {
      gateway.send(JSON.stringify({
        cmd: GATEWAY.CMD_WORKER_MESSAGE,
        clientId,
        data
      }))
    })
  }
}

export default BussinessWorker
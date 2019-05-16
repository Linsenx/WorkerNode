import * as fs from 'fs'
import * as path from 'path'
import * as nanoid from 'nanoid'
import { EventEmitter } from 'events'
import ISocket from '../Connectors/ISocket';

declare interface BaseWorker {
  on(event: string, listener: (...args: any[]) => void): this
  on(event: 'message', listener: (conn: ISocket, message: any) => void): this
  on(event: 'connection', listener: (conn: ISocket) => void): this
  on(event: 'close', listener: (conn: ISocket) => void): this
  on(event: 'workerStart', listener: () => void): this
}

class BaseWorker extends EventEmitter {
  /**
   * Socket name. The format is like this tcp://0.0.0.0:4000
   * ( Supported protocols: tcp, websocket )
   */
  protected socketName: string

  protected host: string

  protected port: Number

  protected protocol: string

  protected id: string

  constructor(socketName: string) {
    super()
    this.id = nanoid()
    this.socketName = socketName
  }

  public listen() {
    if (!this.socketName) {
      return
    }

    let [scheme, address, port] = this.socketName.split(':')
    const protocol = path.resolve(__dirname, `../Connectors/${scheme}`)
    this.host = address.substr(2)
    this.port = parseInt(port)
    this.protocol = scheme
    
    if (!fs.existsSync(protocol)) {
      throw new Error(`protocol '${scheme}' not exist`)
    }
    const socket_path = path.resolve(protocol, './socket.js')
    if (!fs.existsSync(socket_path)) {
      throw new Error(`protocol '${scheme}' socket.js not exist`)
    }
    const connector_path = path.resolve(protocol, './connector.js')
    if (!fs.existsSync(connector_path)) {
      throw new Error(`protocol '${scheme}' connector.js not exist`)
    }

    let _address = address.substr(2)
    const connector_class = require(connector_path)
    const connector = new connector_class(port, _address)
    connector.on('listening', () => {
      this.emit('workerStart')
    })
    connector.on('connection', (conn) => {
      this.emit('connection', conn)
    })
    connector.on('message', (conn, message) => {
      this.emit('message', conn, message)
    })
    connector.on('close', (conn) => {
      this.emit('close', conn)
    })
    connector.start()
  }

  public run() {
    this.listen()
  }
}

export default BaseWorker
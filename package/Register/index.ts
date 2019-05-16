import Worker from '../BaseWorker'
import ISocket from '../Connectors/ISocket'

class Register extends Worker {

  /**
   * 所有 gateway 的连接
   */
  protected gatewayConnections = []

  /**
   *  所有 worker的连接
   */
  protected workerConnections = []

  constructor(socketName: string) {
    super(socketName)
  }

  run() {
    super.run()
    this.on('close', this.onClose.bind(this))
    this.on('connection', this.onConnection.bind(this))
    this.on('message', this.onMessage.bind(this))
  }

  onClose(conn: ISocket) {

  }

  onConnection(conn: ISocket) {

  }

  onMessage(conn: ISocket, message: Buffer) {
    const data = JSON.parse(message.toString())
    const event = data.event || 'undefined_event'

    switch (event) {
      // 是 gateway 连接
      case 'gateway_connect':
        if (data.address === undefined) {
          conn.disconnect()
          return
        }
        this.gatewayConnections.push(data.address)
        this.broadcastAddresses()
        break

      // 是 worker连接
      case 'worker_connect':
        this.workerConnections.push(conn)
        this.broadcastAddresses(conn)
        break

      default:
    }
  }

  broadcastAddresses(conn?: ISocket) {
    const data = JSON.stringify({
      event: 'broadcast_addresses',
      addresses: [...new Set(this.gatewayConnections)]
    })
    if (conn) {
      conn.send(data)
      return
    }
    this.workerConnections.forEach(conn => {
      conn.send(data)
    })
  }
}

export default Register
import * as Stick from 'stickpackage'
import { EventEmitter } from 'events'
import { createConnection, Socket } from 'net'

declare interface TcpConenction {
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: "close", listener: (had_error: boolean) => void): this;
  on(event: "connect", listener: () => void): this;
  on(event: 'message', listener: (data: Buffer) => void): this
  // on(event: "data", listener: (data: Buffer) => void): this;
  on(event: "drain", listener: () => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
  on(event: "timeout", listener: () => void): this;  
}

class TcpConenction extends Socket {
  protected socket: Socket
  protected msgCenter = new Stick.msgCenter()
  public session: any = {}

  constructor(address: string) {
    super()
    this.reconnect(address)
    this.on('data', data => {
      this.msgCenter.putData(data)
    })
    this.msgCenter.onMsgRecv(data => {
      this.emit('message', data)
    })
  }

  reconnect(address: string) {
    const [host, port] = address.split(':')
    this.connect({
      host: host,
      port: parseInt(port)
    })
  }

  send(data: any) {
    const buffer = Buffer.from(data)
    const bufferData = this.msgCenter.publish(buffer)
    this.write(bufferData)
  }
}

export default TcpConenction
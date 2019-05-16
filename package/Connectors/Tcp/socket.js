const net = require('net')
const { EventEmitter } = require('events')
const MsgCenter = require('stickpackage').msgCenter

class Socket extends EventEmitter {
  constructor(socket) {
    super()
    this.session = {}
    this.socket = socket
    this.msgCenter = new MsgCenter()
    this.socket.on('data', (data) => {
      this.emit('message', data)
    })
    this.socket.on('close', () => {
      this.emit('close')
    })
  }

  send(msg) {
    const buffer = Buffer.from(msg)
    const bufferData = this.msgCenter.publish(buffer)
    this.socket.write(bufferData)
  }

  disconnect() {
    throw new Error("Method not implemented.");
  }
}

module.exports = Socket

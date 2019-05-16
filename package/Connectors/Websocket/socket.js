const net = require('net')
const { EventEmitter } = require('events')

class Socket extends EventEmitter {
  constructor(socket) {
    super()
    this.session = {}
    this.socket = socket
    this.on('data', (data) => {
      this.emit('message', data)
    })
  }

  send(msg) {
    this.socket.send(msg)
  }

  disconnect() {
    this.socket.close()
  }  
}

module.exports = Socket

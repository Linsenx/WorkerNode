// const net = require('net')
const uWS = require('uWebSockets.js')
const { EventEmitter } = require('events')
const Socket = require('./socket')

class Connector extends EventEmitter {
  constructor(port, host) {
    super()
    this.port = port
    this.host = host || undefined
  }

  /**
   * Start connector, return false if faild
   */
  start(cb) {
    this.app = uWS.App({})
    if (this.app === null) {
      return false
    }

    this.server = this.app.ws('/*', {
      compression: 0,
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 10 * 60,
      open: (ws, req) => {
        ws.socket = new Socket(ws)
        this.emit('connection', ws.socket)
      },
      close: (ws, code, message) => {
        ws.socket.emit('close')
        this.emit('close', ws.socket)
      },
      message: (ws, message, isBinary) => {
        ws.socket.emit('data', message)
        this.emit('message', ws.socket, message)
      },
      drain: (ws) => {

      }      
    })

    this.server.listen(this.port, (listenSocket) => {
      if (listenSocket) {
        this.emit('listening')        
        console.log(`websocket connector listen on: ${this.host}:${this.port}`)
      }
    })
    return true
  }  

  stop() {
    this.server.close()
    return true
  }
}

module.exports = Connector
const net = require('net')
const { EventEmitter } = require('events')
const Socket = require('./socket')
const MsgCenter = require('stickpackage').msgCenter

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
    this.server = net.createServer()
    if (!(this.server instanceof net.Server)) {
      return false
    }

    this.server.on('listening', () => {
      this.emit('listening')
      console.log(`tcp connector listen on: ${this.host}:${this.port}`)
    })

    // 新用户连接
    this.server.on('connection', (conn) => {
      const socket = new Socket(conn)
      const msgCenter = new MsgCenter()

      this.emit('connection', socket)

      // 接收用户数据
      socket.on('message', message => {
        msgCenter.putData(Buffer.from(message))
      })

      msgCenter.onMsgRecv(data => {
        this.emit('message', socket, data)
      })

      // 用户断开连接
      socket.on('close', () => {
        this.emit('close', socket)
      })
    })

    if (this.host !== undefined) {
      this.server.listen(this.port, this.host)
    } else {
      this.server.listen(this.port)
    }

    return true
  }  

  stop() {
    this.server.close()
    return true
  }
}

module.exports = Connector
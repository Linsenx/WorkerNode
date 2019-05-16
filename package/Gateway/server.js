const uWs = require('uWebSockets.js')
const shortid = require('shortid')
const queryString = require('query-string')
const EventEmitter = require('events').EventEmitter

class SocketServer {
  constructor(opts) {
    this.server = uWs.App({})
    this.processor = null
    this.connections = {}
    this.roomProcesses = {}

    const wsUrl = opts.url || '/*'
    const wsCompression = opts.compression || 0
    const wsMaxPayloadLength = opts.maxPayloadLength || 16 * 1024 * 1024
    const wsIdleTimeout = opts.idleTimeout || 60
  
    this.app = this.server.ws(wsUrl, {
      compression: wsCompression,
      maxPayloadLength: wsMaxPayloadLength,
      idleTimeout: wsIdleTimeout,
      open: this.onConnection.bind(this),
      message: this.onMessage.bind(this),
      drain: this.onDrain.bind(this),
      close: this.onClose.bind(this)
    })
  }

  listen(port) {
    this.app.listen(port, (token) => {
      if (token) {
        console.log(`[paper-engine-gate]: listen to the port: ${process.env.GAME_PORT}`)
      } else {
        console.log(`[paper-engine-gate]: faild to listen the port: ${process.env.GAME_PORT}`)
      }
    })
  }
  
  setProcessor(processor) {
    this.processor = processor
  }

  addRoomProcess(roomid, process) {
    this.roomProcesses[roomid] = process
  }

  getRoomProcess(roomid) {
    if (this.roomProcesses[roomid] !== undefined) {
      return this.roomProcesses[roomid]
    }
    return undefined
  }

  sendToRoom(roomid, message) {
    const roomProcess = this.getRoomProcess(roomid)
    if (roomProcess !== undefined) {
      console.log('sendmsg-to-room', message)
      roomProcess.send(message)
    }
  }

  addConnection(clientid, ws) {
    this.connections[clientid] = ws
  }

  getConnection(clientid) {
    if (this.connections[clientid] !== undefined) {
      return this.connections[clientid]
    }
    return undefined
  }

  onConnection(ws, req) {
    const parsedQuery = queryString.parse(req.getQuery())
    if (parsedQuery.auth === undefined) return
    if (parsedQuery.roomid === undefined) return
    ws._auth = parsedQuery.auth   
    ws._roomid = parsedQuery.roomid
    ws._id = shortid.generate()
    this.addConnection(ws._id, ws)
    this.sendToRoom(ws._roomid, { cmd: 'join', id: ws._id })
  }
  
  onMessage(ws, message, isBinary) {
    // 转发数据到房间服务器
    // if (this.processor != null) {
      if (ws._roomid !== undefined && ws._auth !== undefined) {
        this.sendToRoom(ws._roomid, { cmd: 'message', id: ws._id, msg: Buffer.from(message) })
      }
    // }
  }
  
  onClose(ws, code, message) {
    console.log(ws._id, 'close')
    this.sendToRoom(ws._roomid, { cmd: 'leave', id: ws._id })
  }

  onDrain(ws) {
    
  }
}

module.exports = SocketServer
class Processor {
  onMessageReceived(msgBuffer) {
    const dataView = new DataView(msgBuffer)
    const messageId = dataView.getInt16()
    const protobufMessage = msgBuffer.slice(2)
    return 1
  }
}

module.exports = Processor
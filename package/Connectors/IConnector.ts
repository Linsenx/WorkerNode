interface IConnector {
  port: number
  host?: string
  start(cb: Function): boolean
  stop(): boolean
}

export default IConnector
interface ISocket {
  session: any
  send(msg: any): void
  disconnect(): void
  on(event: string, listener: (...args: any[]) => void): this
  on(event: 'message', listener: (data: any) => void): this
  on(event: 'close', listener: () => void): this
}

export default ISocket
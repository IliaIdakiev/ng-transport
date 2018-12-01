import { ServerHttp2Stream, IncomingHttpHeaders } from "http2";

export interface IRouter {
  [key: string]: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, reqData: { [key: string]: string }, data: any) => void
};
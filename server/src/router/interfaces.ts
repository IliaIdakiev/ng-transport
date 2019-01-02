import * as http2 from 'http2';
import { RouteHandler } from './types';

export interface IRouteHandlerData {
  stream: http2.ServerHttp2Stream,
  params: { [index: string]: string },
  queryParams: { [index: string]: string | string[] }
  data: {}
}

export interface IRouteData {
  handlers: RouteHandler[];
  regExp: RegExp;
  path: string;
  constructParams?: (matches: string[]) => { [key: string]: string };
}

export interface ISubscriptionData extends IRouteData {
  streams: Set<http2.ServerHttp2Stream>,
  requestData: Map<http2.ServerHttp2Stream, any>;
}

export interface IServerPushCollection {
  [key: string]: {
    path: string;
    regExp: RegExp;
    pushData: (string | { path: string, fullPath: boolean, responsePath: string })[];
  };
}

export interface IPushConfig {
  [path: string]: (string | { path: string, fullPath: boolean, responsePath: string })[];
}

export interface IRouterConfig {
  staticFolderPath?: string,
  index?: string,
  staticPath?: string,
  push?: IPushConfig,
  useStaticForPush?: boolean;
}
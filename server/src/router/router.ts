import * as http2 from 'http2';
import * as url from 'url';
import * as querystring from 'querystring';
import * as pathToRegexp from 'path-to-regexp';
import { Method } from './enums';
import { RouteCollection } from './route-collection';
import { Router, RouteHandler } from './types';
import { ISubscriptionData, IRouterConfig } from './interfaces';
import {
  serveStaticFile,
  findAndExecuteHandlers,
  condExec,
  findAndExecuteSubscriptions,
  returnNotFound,
  processServerPush,
  constructServerPushCollection
} from './utils';

const router: Router = {
  [Method.GET]: new RouteCollection(),
  [Method.POST]: new RouteCollection(),
  [Method.PUT]: new RouteCollection(),
  [Method.DELETE]: new RouteCollection()
};
const subscriptionRouter = new RouteCollection<ISubscriptionData>();

function registerRoute(method: Method) {
  return function (path: string, ...handlers: RouteHandler[]) {
    var regExp = pathToRegexp(path);
    router[method].add({ handlers, regExp, path });
  };
}

function registerMemoizedSubscription(path: string, ...handlers: RouteHandler[]) {
  var regExp = pathToRegexp(path);
  subscriptionRouter.add({ path, handlers, regExp, streams: {} });
}

let isConnected = false;

export function connect(server: http2.Http2SecureServer, config?: IRouterConfig) {
  if (isConnected) { throw new Error('Router is already connected!'); }
  isConnected = true;

  const pushDataCollection = config.push ? constructServerPushCollection(config.push) : null;

  server.on('stream', (stream, headers) => {
    const methodString = headers[':method'].toUpperCase();
    const pathString = decodeURIComponent(headers[":path"]);
    const method = Method[methodString as keyof typeof Method];
    const urlPath = url.parse(pathString);

    const queryParams = querystring.parse(urlPath.query);
    let pathname = urlPath.pathname;

    if (pushDataCollection) {
      processServerPush(pushDataCollection, pathname, config.useStaticForPush, config.staticFolderPath, stream);
    }

    if (config.staticPath === pathname && pathname[pathname.length - 1] === '/' && config.index) {
      pathname += config.index;
    }

    const serverStatic = !config.staticFolderPath ?
      Promise.resolve(true) : serveStaticFile(pathname, config.staticFolderPath, stream);

    serverStatic
      .then(condExec(findAndExecuteHandlers.bind(undefined, router, method, pathname, queryParams, stream)))
      .then(condExec(findAndExecuteSubscriptions.bind(undefined, subscriptionRouter, method, pathname, queryParams, stream)))
      .then(condExec(returnNotFound.bind(undefined, methodString, pathString, stream)));
  });

  return {
    get: registerRoute(Method.GET),
    post: registerRoute(Method.POST),
    put: registerRoute(Method.PUT),
    delete: registerRoute(Method.DELETE),
    subscribe: registerMemoizedSubscription,
  }
}


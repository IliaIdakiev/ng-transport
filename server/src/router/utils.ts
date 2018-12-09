import * as http2 from 'http2';
import * as path from 'path';
import * as fs from 'fs';
import { Router, RouteHandler } from './types';
import { IRouteData, ISubscriptionData, IServerPushCollection, IPushConfig } from './interfaces';
import { Method } from './enums';
import pathToRegexp = require('path-to-regexp');
import { RouteCollection } from './route-collection';

function execNextHandler<T>(
  iterator: Iterator<RouteHandler>,
  route: IRouteData,
  queryParams: any,
  match: RegExpMatchArray,
  stream: http2.ServerHttp2Stream,
  data: any,
  callback?: any
) {
  const { value: handler } = iterator.next();
  if (!handler) { return; }
  const routeData = { stream, params: route.constructParams(match.slice(1)), queryParams, data };
  handler(routeData, (err: Error) => {
    if (err) { console.error(err); return; }
    execNextHandler(iterator, route, queryParams, match, stream, routeData.data, callback);
  }, () => { if (callback) { callback(); } });
}


export function condExec(func: Function) {
  return function (shouldProcess: boolean) {
    if (!shouldProcess) { return false }
    return func();
  };
}

export function findAndExecuteHandlers(router: Router, method: Method, pathname: string, queryParams: any, stream: http2.ServerHttp2Stream) {
  return new Promise((resolve) => {
    const match = pathname.match(router[method]);

    if (!match) { resolve(true); return; }
    const route = router[method][match.index] as IRouteData;
    const handersIterator: Iterator<RouteHandler> = route.handlers[Symbol.iterator]();

    execNextHandler(handersIterator, route, queryParams, match, stream, {}, () => {
      resolve(true);
    });
  });
}

export function findAndExecuteSubscriptions(subscriptions: RouteCollection<ISubscriptionData>, method: Method, pathname: string, queryParams: any, stream: http2.ServerHttp2Stream) {
  return new Promise((resolve) => {
    const subscriptionMatch = pathname.match(subscriptions);
    if (!subscriptionMatch) { resolve(true); return; }

    const subscriptionRoute = subscriptions[subscriptionMatch.index] as ISubscriptionData;
    if (method === Method.GET) {
      const streamId = (stream as any).id;
      subscriptionRoute.streams[streamId] = stream;
      subscriptionRoute.requestData[streamId] = { queryParams };
      stream.on('aborted', () => {
        const { [streamId]: currentStream, ...others } = subscriptionRoute.streams as any;
        subscriptionRoute.streams = { ...others };
      });
    }

    Object.keys(subscriptionRoute.streams).forEach(streamId => {
      const subStream = subscriptionRoute.streams[+streamId];
      const { queryParams } = subscriptionRoute.requestData[+streamId];
      const subscriptionsIterator: Iterator<RouteHandler> = subscriptionRoute.handlers[Symbol.iterator]();

      execNextHandler(subscriptionsIterator, subscriptionRoute, queryParams, subscriptionMatch, subStream, {});
    });

  });
}

export function serveStaticFile(pathname: string, staticFolderPath: string, stream: http2.ServerHttp2Stream) {
  return new Promise((resolve) => {
    const parsedPath = path.parse(pathname);
    if (!parsedPath.ext) { resolve(true); return; }
    const filePath = path.join(staticFolderPath, pathname);
    fs.exists(filePath, function (exists) {
      if (exists) {
        fs.createReadStream(filePath).pipe(stream);
      }
      resolve(!exists);
    });
  });
}

export function returnNotFound(methodString: string, pathString: string, stream: http2.ServerHttp2Stream) {
  stream.respond({ ':status': 404, 'content-type': 'text/plain' });
  stream.end(`Cannot ${methodString} ${pathString}.`);
  return Promise.resolve(false);
}

export function processServerPush(pushData: IServerPushCollection, pathname: string, useStaticForPush: boolean, staticFolderPath: string, stream: http2.ServerHttp2Stream) {
  const pushDataForRoute = Object.values(pushData).find(({ regExp }) => !!regExp.exec(pathname));
  if (pushDataForRoute) {
    pushDataForRoute.pushData.forEach(assetPath => {
      let fullAssetPath = typeof assetPath === 'string' ? assetPath : assetPath.path;
      if (useStaticForPush && !(assetPath as any)['fullPath']) { fullAssetPath = path.join(staticFolderPath, fullAssetPath); }
      if (!stream.aborted && !stream.closed) {
        const readStream = fs.createReadStream(fullAssetPath);
        readStream.on('error', function (err) {
          console.error(err);
        });
        const responsePath = typeof assetPath === 'string' ? `${pushDataForRoute.path}${assetPath}` : assetPath.responsePath;
        console.log(`Server Push: ${responsePath}`);
        stream.pushStream({ ':path': responsePath }, (err, pushStream) => {
          if (err) { console.error(err); return; }
          readStream.pipe(pushStream);
          pushStream.on('error', (err) => {
            const isRefusedStream = err.message === 'Stream closed with error code NGHTTP2_REFUSED_STREAM';
            if (!isRefusedStream) { throw err; }
          });
        });
      }
    });
  }
}

export function constructServerPushCollection(push: IPushConfig) {
  return Object.keys(push).reduce((acc, curr) => {
    acc[curr] = { path: curr, regExp: pathToRegexp(curr), pushData: push[curr] };
    return acc;
  }, {} as { [key: string]: { path: string, regExp: RegExp, pushData: (string | { path: string, fullPath: boolean, responsePath: string })[] } })
}
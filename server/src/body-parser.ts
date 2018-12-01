import * as protobuf from 'protobufjs';
import * as path from 'path';
import { ServerHttp2Stream } from 'http2';
import { RouteHandler } from './router/types';

function appendBuffer(buffer1: Buffer, buffer2: Buffer): Buffer {
  var result = new Buffer(buffer1.byteLength + buffer2.byteLength);
  result.set(new Buffer(buffer1), 0);
  result.set(new Buffer(buffer2), buffer1.byteLength);
  return result;
};

function collectData(stream: ServerHttp2Stream, cb: (err: Error, content: Buffer) => void) {
  let content = new Buffer(0);
  stream.on('data', (data: Buffer) => {
    content = appendBuffer(content, data);
  });

  stream.on('end', () => {
    cb(null, content);
    content = new Buffer(0);
  });
}

export const jsonBodyParser: RouteHandler = (routeData, next) => {
  collectData(routeData.stream, (err, buffer) => {
    if (err) { next(err); return; }
    routeData.data = { ...routeData.data, body: JSON.parse(buffer.toString()) };
    next();
  });
};

export function protobufBodyParser(protos: { [name: string]: string }, protoFolderPath?: string) {
  const rootsByName: { [name: string]: protobuf.Root } = {};
  for (let [key, file] of Object.entries(protos)) {
    const location = path.join(protoFolderPath || '', file);
    const root = protobuf.loadSync(location);
    rootsByName[key] = root;
  }
  return function (name: string, namespace: string, message: string): RouteHandler {
    return (routeData, next) => {
      collectData(routeData.stream, (err, buffer) => {
        if (err) { next(err); return; }
        const protoMessage = rootsByName[name].lookupType(`${namespace}.${message}`);
        try {
          routeData.data = { ...routeData.data, body: protoMessage.decode(buffer) };
        } catch (err) {
          next(err);
        }
      });
    };
  }
}
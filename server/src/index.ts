import * as  http2 from 'http2';
import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { connect } from './router/router';
import { jsonBodyParser, protobufBodyParser } from './body-parser';

const protoPath = path.resolve(__dirname, '../protos');
const staticPath = path.resolve(__dirname, '../../public/dist/front');

const protobufParser = protobufBodyParser({
  'user': 'user.proto'
}, protoPath);


// function isStaticAsset(reqPath: string) {
//   const pathObj = path.parse(reqPath);
//   return ['html', 'js', 'css', 'png', 'jpg', 'jpeg'].includes(pathObj.ext);
// }

// contentType = {
//   'html': 'text/html', 
//   'js':  'application/javascript', 
//   'css': 'text/stylesheet'
// }

// function badRequest(stream: http2.ServerHttp2Stream): void {
//   stream.respond({
//     'content-type': 'text/html',
//     ':status': 400
//   });
//   stream.end('<div>400 Bad request!</div>');
// }

// function pageNotFount(stream: http2.ServerHttp2Stream): void {
//   stream.respond({
//     'content-type': 'text/html',
//     ':status': 404
//   });
//   stream.end('<div>404 Page not found!</div>');
// }

const users = [
  {
    name: 'Ivan',
    age: 20
  },
  {
    name: 'Steven',
    age: 21
  }
];

// const subscriptions: { [key: number]: any } = {};

// function defineProto(type: string) {
//   let protoRoot: protobuf.Root = null;
//   return function getProto() {
//     if (protoRoot) { return protoRoot; }
//     protobuf.load(__dirname + '/../protos/user.proto', (err, root) => {
//       if (err) { console.error(err); return; }
//       const UsersMessage = root.lookupType("user.UsersMessage");
//       const errMsg = UsersMessage.verify({ users });
//       if (errMsg) {
//         throw Error(errMsg);
//       }

//       var message = UsersMessage.fromObject({ users });

//       var buffer = UsersMessage.encode(message).finish();

//       // var message = UsersMessage.decode(buffer);
//     });
//   }
// }


// const router: IRouter = {
//   '/api/users': (stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders, requestQuery, data) => {
//     const method = headers[":method"];
//     if (method === 'GET') {
//       stream.respond({
//         'api-response-type': 'json',
//         ':status': 200
//       });
//       const streamId = (stream as any).id;

//       stream.write(JSON.stringify(users));
//       // stream.write('<[SEPARATOR]>');
//       subscriptions[streamId] = stream;

//       stream.on('close', () => {
//         delete subscriptions[streamId];
//       });
//     } else if (method === 'POST') {
//       users.push(data);
//       stream.respond({
//         'content-type': 'application/json',
//         ':status': 200
//       });
//       stream.end(JSON.stringify(users));
//       Object.values(subscriptions).forEach(str => {
//         str.write(JSON.stringify(users));
//         str.write('<[SEPARATOR]>');
//       });
//     }
//   },
// }

const server = http2.createSecureServer({
  key: fs.readFileSync('localhost-privkey.pem'),
  cert: fs.readFileSync('localhost-cert.pem')
});

server.on('error', (err) => console.error(err));

const router = connect(server, {
  staticFolderPath: staticPath,
  index: 'index.html',
  staticPath: '/',
  useStaticForPush: true,
  push: {
    '/': ['main.js', 'polyfills.js', 'runtime.js', 'styles.js', 'vendor.js']
  }
});

function delay(data: any, next: any) {
  setTimeout(function () {
    next();
  }, 5000);
}

router.post('/api/users', jsonBodyParser, function ({ stream, data }, next, notifier) {
  const { name, age } = (data as any).body;
  users.push({ name, age });
  notifier();
  stream.respond({
    ':status': 201
  });
  stream.end();
});

router.subscribe('/api/users', function ({ stream, data }) {
  if (!stream.headersSent) {
    stream.respond({
      'api-response-type': 'json',
      ':status': 200
    });
  }
  stream.write(JSON.stringify(users));
  stream.write('<[SEPARATOR]>');
});

router.get('/protos/:name', function ({ stream, params }) {
  stream.respond({
    'content-type': 'text/plain',
    ':status': 200
  });

  fs.createReadStream(path.join(protoPath, params.name)).pipe(stream);
});

router.get('/', delay, function ({ stream }) {
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  fs.createReadStream(path.join(staticPath, 'index.html')).pipe(stream);
});

// server.on('stream', (stream, headers) => {
//   let fullReqPath = decodeURIComponent(headers[":path"]);
//   if (fullReqPath.includes('/protos/')) {
//     fs.readFile(path.join(__dirname, '..', fullReqPath), (err, content) => {
//       if (err) {
//         pageNotFount(stream);
//         return;
//       }
//       stream.respond({
//         // 'content-type': contentType,
//         ':status': 200
//       });
//       stream.end(content);
//     });
//     return;
//   }
//   if (!fullReqPath.includes('/api')) {
//     if (fullReqPath === '/') { fullReqPath = '/index.html' }

//     fs.readFile(path.join(staticPath, fullReqPath), (err, content) => {
//       if (err) {
//         pageNotFount(stream);
//         return;
//       }
//       const contentType =
//         stream.respond({
//           // 'content-type': contentType,
//           ':status': 200
//         });
//       stream.end(content);
//     });
//   } else {
//     const [, requestPath, requestQueryString = ''] = /([^\?]*)\??(.*)/.exec(fullReqPath);
//     const requestQuery = requestQueryString === '' ? {} : requestQueryString.split('&').reduce((acc: { [key: string]: string }, queryParam) => {
//       const [key, value] = queryParam.split('=');
//       acc[key] = value;
//       return acc;
//     }, {});
//     if (headers[":method"] === 'POST' || headers[":method"] === 'PUT') {
//       let content = new Buffer(0);
//       stream.on('data', (data: Buffer) => {
//         content = appendBuffer(content, data);
//       })
//       stream.on('end', () => {
//         (router[requestPath] || pageNotFount)(stream, headers, requestQuery, JSON.parse(content.toString()));
//         content = new Buffer(0);
//       });
//     } else {
//       (router[requestPath] || pageNotFount)(stream, headers, requestQuery, null);
//     }
//   }
// });

server.listen(8443);

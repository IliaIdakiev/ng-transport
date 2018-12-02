import * as  http2 from 'http2';
import * as fs from 'fs';
import * as path from 'path';
import { connect } from './router/router';
import { jsonBodyParser, protobufParsers } from './parsers';

const protoPath = path.resolve(__dirname, '../protos');
const staticPath = path.resolve(__dirname, '../../public/dist/front');

const protobufParser = protobufParsers({
  'user': 'user.proto'
}, protoPath);

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
  setTimeout(function () {
    users.push({ name, age });
    notifier();
    stream.respond({
      ':status': 201
    });
    stream.end();
  }, 2000);
});

router.subscribe('/api/users', function ({ stream, data }) {
  if (!stream.headersSent) {
    stream.setTimeout(0);
    stream.respond({
      'api-response-type': 'json',
      'connnection': 'keep-alive',
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

(server as any).setTimeout(0);
server.listen(8443, function () {
  console.log('Server is listening on 8443');
});

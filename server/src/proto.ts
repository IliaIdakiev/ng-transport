import * as protobuf from 'protobufjs';

const protoFolderPath = __dirname + '/../protos/';

export class ProtoMessage<T extends Object> {
  isReady: boolean = false;

  private type: protobuf.Type = null;

  constructor(packageName: string, messageName: string) {
    this._load(packageName).then((root) => {
      this.type = root.lookupType(`${packageName}.${messageName}`);
      this.isReady = true;
    });
  }

  private _load = (packageName: string) => new Promise<protobuf.Root>(function (resolve, reject) {
    protobuf.load(`${protoFolderPath}${packageName}.proto`, (err, root) => {
      if (err) { reject(err); return; }
      resolve(root);
    });
  })

  encode = (data: T) => new Promise((resolve, reject) => {
    const error = this.type.verify(data);
    if (error) { reject(error); return; }
    const message = this.type.fromObject(data);
    const buffer = this.type.encode(message).finish();
    resolve(buffer);
  });

  decode = (buff: Uint8Array) => Promise.resolve<protobuf.Message<T>>(this.type.decode(buff))
}
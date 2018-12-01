import { IRouteData } from "./interfaces";

export class RouteCollection<T extends IRouteData> {
  [key: string]: any;
  constructor(private collection: T[] = []) {
    return new Proxy(this, {
      get: (target: RouteCollection<T>, key: string | number | symbol, receiver: any) => {
        let keyAsNumber = null;
        if (typeof key === 'string') {
          keyAsNumber = +key;
        } else if (typeof key === 'number') {
          keyAsNumber = key;
        }
        const routeData = typeof keyAsNumber === 'number' ? target.collection[keyAsNumber] : null;
        return routeData ? routeData : Reflect.get(target, key, receiver);
      }
    });
  }

  add = (routeData: T) => {
    const parts = routeData.path.split(':').slice(1);
    routeData.constructParams = matches => {
      return parts.reduce((acc, key, index) => {
        acc[key] = matches[index];
        return acc;
      }, {} as { [key: string]: string })
    };

    this.collection.push(routeData);
  }

  [Symbol.match] = (path: string) => {
    let i = 0;
    for (i; i < this.collection.length; i++) {
      const item = this.collection[i];
      const match = item.regExp.exec(path);
      if (match) {
        match.index = i;
        return match;
      }
    }
    return null;
  }
}
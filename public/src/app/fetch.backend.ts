import { Injectable } from '@angular/core';

import { HttpBackend, HttpRequest, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, from, empty } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

declare const TextDecoder;

import { load } from 'protobufjs';

@Injectable()
export class FetchBackend implements HttpBackend {
  handle(req: HttpRequest<any>): Observable<HttpEvent<any>> {

    const fetchPromise = fetch(req.url, {
      method: req.method,
      headers: req.headers.keys().reduce((acc, key) => { acc[key] = req.headers.get(key); return acc; }, {}),
      body: req.body ? JSON.stringify(req.body) : undefined
    }).then(response => {
      if (response.ok) { return response; }
      throw new Error('Network error!');
    });
    return from(fetchPromise).pipe(
      switchMap(this.processChunkedResponse),
      catchError((err, caught) => {
        console.error(err);
        // return caught;
        return empty();
      })
    );
  }

  private processChunkedResponse(response: Response): Observable<HttpEvent<any>> {
    const headers = [...(response.headers as any).entries()].reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

    return new Observable(observer => {
      let text = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const apiResponseType = response.headers.get('api-response-type');

      function readChunk() {
        return reader.read().then(appendChunks);
      }

      function appendChunks(result) {
        const chunk = decoder.decode(result.value || new Uint8Array, { stream: !result.done });
        text += chunk;

        const splittedText = text.split('<[SEPARATOR]>');
        if (splittedText[1] !== undefined) {
          const message = splittedText[0];
          text = splittedText[1];
          observer.next(new HttpResponse({
            body: apiResponseType === 'json' ? JSON.parse(message) : message,
            headers: headers,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
          }));
          // load('/protos/user.proto', (err, root) => {
          //   const type = root.lookupType(`user.UsersMessage`);
          //   const result1 = this.type.decode(message);
          //   observer.next(new HttpResponse({
          //     body: apiResponseType === 'json' ? JSON.parse(message) : message,
          //     headers: response.headers,
          //     status: response.status,
          //     statusText: response.statusText,
          //     url: response.url,
          //   }));
          // });
        }
        console.log('text so far is', text.length, 'bytes\n');
        if (result.done) {
          observer.complete();
        } else {
          return readChunk();
        }
      }

      readChunk().catch(err => {
        // set interval to reconnect!
        console.error(err);
      });
      return () => {
        console.log('Cleanup');
      };
    });
  }

}

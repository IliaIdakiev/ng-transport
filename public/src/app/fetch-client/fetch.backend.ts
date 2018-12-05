import { Injectable } from '@angular/core';

import { HttpBackend, HttpRequest, HttpEvent, HttpResponse, HttpHeaders } from '@angular/common/http';
import { Observable, from as observableFrom, empty as observableEmpty } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

declare const TextDecoder;

import { load, Reader } from 'protobufjs';

@Injectable()
export class FetchBackend implements HttpBackend {

  private prepareFetchHeaders(headers: HttpHeaders) {
    return headers.keys().reduce((acc, key) => {
      acc[key] = headers.get(key); return acc;
    }, {});
  }

  private prepareFetchBody(body: any) {
    return typeof body === 'string' ? body : JSON.stringify(body);
  }

  private getResponseHeaders(response: any) {
    return [...response.headers.entries()].reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  handle(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const method = req.method;
    const headers = this.prepareFetchHeaders(req.headers);
    const body = req.body ? this.prepareFetchBody(req.body) : undefined;
    const abortController = new AbortController();

    const fetchPromise = fetch(req.url, { method, headers, body, signal: abortController.signal }).then(response => {
      if (response.ok) { return response; }
      throw new Error(response.statusText);
    });

    return observableFrom(fetchPromise).pipe(
      switchMap(this.getResponseProcessor(abortController)),
      catchError((err, caught) => {
        console.error(err);
        return observableEmpty();
      })
    );
  }

  private getDecoder(responseHeaders: { [key: string]: any }) {
    const contentType = responseHeaders['content-type'];
    // construct decoder for response type
    return new TextDecoder();
  }

  private protobufProcessor = (decoder, partialContent, emitter) => {
    return load('/protos/user.proto').then(root => {
      const msg = root.lookupType('user.UsersMessage');
      const msgReader = Reader.create(partialContent);
      let shouldRead = true;
      // const result = [];
      while (shouldRead) {
        try {
          const message = msg.decodeDelimited(msgReader);
          partialContent = partialContent.slice(msgReader.pos);
          emitter(partialContent, (message as any).users);
          if (partialContent.length !== 0) { continue; }
          partialContent = new Uint8Array();
          shouldRead = false;
        } catch (e) {
          shouldRead = false;
        }
      }

      // emitter(partialContent, result);
      // return read().then(readHandler);
    });
  }

  private jsonProcessor = (decoder, partialContent, emitter) => {
    const delimiter = '\n'.charCodeAt(0); // https://en.wikipedia.org/wiki/JSON_streaming
    const delimiterIndex = partialContent.indexOf(delimiter);

    if (delimiterIndex !== -1) {
      const message = decoder.decode(partialContent.slice(0, delimiterIndex));
      partialContent = partialContent.slice(delimiterIndex + 1);

      return emitter(partialContent, JSON.parse(message));
    }
  }

  private constructResponse = (response, headers, body) => {
    return new HttpResponse({
      body: body,
      headers: headers,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
  }

  private getResponseProcessor = (abortController: AbortController) => {
    return (response: Response) => {
      const headers = this.getResponseHeaders(response);
      const decoder = this.getDecoder(headers);

      const reader = response.body.getReader();
      const read = () => reader.read();
      let partialContent = new Uint8Array();

      return new Observable<any>(observer => {
        read().then(function readHandler({ done, value }) {
          if (done) { observer.complete(); return; }
          const currentContent = partialContent;
          partialContent = new Uint8Array(partialContent.length + value.length);
          partialContent.set(currentContent);
          partialContent.set(value, currentContent.length);

          const isJSONResponse = headers['content-type'] !== 'application/json';
          const processor = isJSONResponse ? this.jsonProcessor : this.protobufProcessor;

          processor(decoder, partialContent, (newPartialContent, message) => {
            partialContent = newPartialContent;
            observer.next(this.constructResponse(response, headers, message));
          }).then(read).then(readHandler);
        }.bind(this));

        return () => {
          abortController.abort();
        };
      });
    };
  }
}

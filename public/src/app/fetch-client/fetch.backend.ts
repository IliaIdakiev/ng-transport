import { Injectable, Inject } from '@angular/core';

import { HttpBackend, HttpRequest, HttpEvent, HttpResponse, HttpHeaders } from '@angular/common/http';
import { Observable, from as observableFrom, empty as observableEmpty } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

declare const TextDecoder;

import { load, Reader } from 'protobufjs';
import { PROTO_BUFFER_URL } from './injection-tokens';

@Injectable()
export class FetchBackend implements HttpBackend {

  constructor(@Inject(PROTO_BUFFER_URL) private protoBufsUrl: string) { }

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
      switchMap((response) => {
        const responseHeaders = this.getResponseHeaders(response);
        if (['application/json', 'application/octet-stream'].includes(responseHeaders['content-type'])) {
          return this.getResponseProcessor(abortController)(response);
        }
        return response.text();
      }),
      catchError((err, caught) => {
        console.error(err);
        return observableEmpty();
      })
    );
  }

  private getDecoder(type: string, protoFile: string, protoMessage: string) {
    if (type === 'json') { return new TextDecoder(); }
    return load(`${this.protoBufsUrl}${protoFile}`).then(root => root.lookupType(protoMessage));
  }

  private protobufProcessor = (decoder, partialContent, emitter) => {
    return decoder.then(dec => {
      const msgReader = Reader.create(partialContent);
      let shouldDecode = true;
      let error = null;
      while (shouldDecode) {
        try {
          const message = dec.decodeDelimited(msgReader);
          partialContent = partialContent.slice(msgReader.pos);
          emitter(partialContent, (message as any).users);
          if (partialContent.length !== 0) { continue; }
          partialContent = new Uint8Array();
          shouldDecode = false;
        } catch (e) {
          if (!e.message.includes('index out of range')) { error = e; }
          shouldDecode = false;
        } finally {
          if (error) { throw error; }
        }
      }
    });
  }

  private jsonProcessor = (decoder, partialContent, emitter) => {
    const delimiter = '\n'.charCodeAt(0); // https://en.wikipedia.org/wiki/JSON_streaming

    while (true) {
      const delimiterIndex = partialContent.indexOf(delimiter);
      if (delimiterIndex === -1) { break; }
      const message = decoder.decode(partialContent.slice(0, delimiterIndex));
      partialContent = partialContent.slice(delimiterIndex + 1);

      emitter(partialContent, JSON.parse(message));
    }

    return Promise.resolve();
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
      const isJSONResponse = headers['content-type'] === 'application/json';
      const { type, processor } = isJSONResponse ?
        { type: 'json', processor: this.jsonProcessor } : { type: 'protobuf', processor: this.protobufProcessor };

      const decoder = this.getDecoder(type, headers['proto-file'], headers['proto-message']);

      const reader = response.body.getReader();
      const read = () => reader.read();
      const constructResponse = this.constructResponse;
      let partialContent = new Uint8Array();

      return new Observable<any>(observer => {
        read().then(function readHandler({ done, value }) {
          if (done) { observer.complete(); return; }
          const currentContent = partialContent;
          partialContent = new Uint8Array(partialContent.length + value.length);
          partialContent.set(currentContent);
          partialContent.set(value, currentContent.length);

          processor(decoder, partialContent, (newPartialContent, message) => {
            partialContent = newPartialContent;
            observer.next(constructResponse(response, headers, message));
          }).then(read).then(readHandler);
        });

        return () => {
          abortController.abort();
        };
      });
    };
  }
}

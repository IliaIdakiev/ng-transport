import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FetchBackend } from './fetch.backend';

@Injectable()
export class FetchClient extends HttpClient {
  constructor(fetchHandler: FetchBackend) {
    super(fetchHandler);
  }
}

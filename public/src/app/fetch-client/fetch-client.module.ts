import { HttpBackend, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FetchBackend } from './fetch.backend';
import { FetchClient } from './fetch-client';

@NgModule({
  imports: [
    HttpClientModule
  ],
  declarations: [],
  providers: [
    FetchBackend,
    FetchClient
  ]
})
export class FetchClientModule { }

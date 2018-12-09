import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { FetchClientModule } from './fetch-client/fetch-client.module';
import { PROTO_BUFFER_URL } from './fetch-client/injection-tokens';
// import { HttpClientModule, HttpBackend } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent
  ],
  providers: [
    {
      provide: PROTO_BUFFER_URL,
      useValue: '/protos/'
    }
  ],
  imports: [
    BrowserModule,
    FetchClientModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

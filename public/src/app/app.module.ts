import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { FetchClientModule } from './fetch-client/fetch-client.module';
// import { HttpClientModule, HttpBackend } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FetchClientModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

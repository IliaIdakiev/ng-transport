import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { HttpClientModule, HttpBackend } from '@angular/common/http';
import { FetchBackend } from './fetch.backend';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [
    {
      provide: HttpBackend,
      useClass: FetchBackend
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

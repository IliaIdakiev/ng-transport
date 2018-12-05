import { Component, ViewChild, ElementRef } from '@angular/core';
import { Observable } from 'rxjs';
import { FetchClient } from './fetch-client/fetch-client';

@Component({
  selector: 'hns-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  @ViewChild('userName') userName: ElementRef;
  @ViewChild('userAge') userAge: ElementRef;
  users$: Observable<{ name: string, age: number }[]>;

  constructor(public http: FetchClient) {
    this.users$ = http.get<{ name: string, age: number }[]>('/api/users');
  }

  addUser() {
    const [{ value: name }, { value: age }] = [this.userName.nativeElement, this.userAge.nativeElement];
    this.http.post('/api/users', { name, age }).subscribe(() => {
      console.log('user was added');
    });
    this.userAge.nativeElement.value = '';
    this.userName.nativeElement.value = '';
  }
}

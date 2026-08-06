import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog.component';
import { ToastComponent } from './components/shared/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, ToastComponent],
  template: '<router-outlet></router-outlet><app-confirm-dialog></app-confirm-dialog><app-toast></app-toast>',
})
export class AppComponent {}

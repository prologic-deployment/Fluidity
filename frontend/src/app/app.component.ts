import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent],
  template: '<router-outlet></router-outlet><app-confirm-dialog></app-confirm-dialog>',
})
export class AppComponent {}

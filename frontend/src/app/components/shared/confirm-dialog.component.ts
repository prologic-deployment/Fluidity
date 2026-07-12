import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  state$ = this.confirmDialog.state$;

  constructor(public confirmDialog: ConfirmDialogService) {}

  respond(result: boolean): void {
    this.confirmDialog.respond(result);
  }
}

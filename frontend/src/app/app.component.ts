import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './components/shared/confirm-dialog.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent],
  template: '<router-outlet></router-outlet><app-confirm-dialog></app-confirm-dialog>',
})
export class AppComponent implements OnInit {
  constructor(private theme: ThemeService) {}

  ngOnInit(): void {
    // Applique le thème chargé (resynchronise .dark sur <html> après le
    // script inline d'index.html qui évite le scintillement au démarrage).
    this.theme.apply(this.theme.isDark ? 'dark' : 'light');
  }
}

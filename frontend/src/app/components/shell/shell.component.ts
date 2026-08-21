import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { PasswordReminderComponent } from '../shared/password-reminder.component';
import { AuthService } from '../../services/auth.service';

/**
 * Structure principale de l'application authentifiée :
 *   - sidebar à gauche (toujours visible sur desktop ≥ lg ; superposable sur
 *     mobile via le bouton du topbar, avec fond assombri + fermeture ESC) ;
 *   - colonne de droite : topbar sticky (fil d'Ariane + menu utilisateur)
 *     puis le contenu de la page (router-outlet).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, PasswordReminderComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  /** Rappel de changement de mot de passe (client en mot de passe provisoire). */
  showPasswordReminder = false;
  private readonly destroy$ = new Subject<void>();

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    // Chaque navigation referme la sidebar sur mobile
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => (this.mobileMenuOpen = false));

    // Rappel de sécurité : réapparaît tant que mustChangePassword est actif.
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((u) => {
      this.showPasswordReminder = !!u?.mustChangePassword;
    });
    this.showPasswordReminder = this.auth.mustChangePassword();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mobileMenuOpen = false;
  }
}

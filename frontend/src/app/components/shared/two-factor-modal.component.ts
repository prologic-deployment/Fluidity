import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

/**
 * Modale de configuration de la double authentification (TOTP).
 * Étapes : explication → QR code + clé manuelle → saisie du code → succès
 * (codes de secours affichés une seule fois). La 2FA n'est activée qu'après
 * vérification réussie côté serveur.
 */
@Component({
  selector: 'app-two-factor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './two-factor-modal.component.html',
})
export class TwoFactorModalComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() activated = new EventEmitter<void>();

  step: 'setup' | 'success' = 'setup';
  loading = false;
  error: string | null = null;

  qrCode: string | null = null;
  manualKey: string | null = null;
  code = '';
  backupCodes: string[] = [];

  constructor(private auth: AuthService) {}

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }

  close(): void {
    if (!this.loading) this.closed.emit();
  }

  /** Lance le setup : génère le secret + QR code (jamais activé avant vérification). */
  startSetup(): void {
    this.loading = true;
    this.error = null;
    this.auth.twoFactorSetup().subscribe({
      next: (r) => {
        this.qrCode = r.qrCode;
        this.manualKey = r.manualKey;
        this.code = '';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la configuration.';
        this.loading = false;
      },
    });
  }

  verify(): void {
    if (!this.code) return;
    this.loading = true;
    this.error = null;
    this.auth.twoFactorVerifySetup(this.code).subscribe({
      next: (r) => {
        this.backupCodes = r.backupCodes;
        this.step = 'success';
        this.loading = false;
        this.activated.emit();
      },
      error: (err) => {
        this.error = err.error?.message || 'Code invalide. Réessayez.';
        this.loading = false;
      },
    });
  }
}

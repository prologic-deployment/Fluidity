import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TwoFactorStatus, LoginActivity } from '../../models/user.model';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './security-page.component.html',
})
export class SecurityPageComponent implements OnInit {
  status: TwoFactorStatus | null = null;
  loading = true;
  error: string | null = null;
  success: string | null = null;

  // 2FA setup
  qrCode: string | null = null;
  manualKey: string | null = null;
  setupCode = '';
  backupCodes: string[] = [];

  // Disable
  disablePassword = '';
  disableCode = '';

  // Login activity
  activities: LoginActivity[] = [];

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.loadStatus();
    this.loadActivity();
  }

  loadStatus(): void {
    this.auth.twoFactorStatus().subscribe({
      next: (s) => {
        this.status = s;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger l’état 2FA.';
        this.loading = false;
      },
    });
  }

  loadActivity(): void {
    this.auth.loginActivity(1, 10).subscribe({
      next: (r) => (this.activities = r.activites),
      error: () => {},
    });
  }

  startSetup(): void {
    this.error = null;
    this.success = null;
    this.auth.twoFactorSetup().subscribe({
      next: (r) => {
        this.qrCode = r.qrCode;
        this.manualKey = r.manualKey;
        this.setupCode = '';
      },
      error: (err) => (this.error = err.error?.message || 'Erreur lors du setup.'),
    });
  }

  verifySetup(): void {
    this.error = null;
    this.auth.twoFactorVerifySetup(this.setupCode).subscribe({
      next: (r) => {
        this.backupCodes = r.backupCodes;
        this.qrCode = null;
        this.manualKey = null;
        this.setupCode = '';
        this.success = 'Double authentification activée.';
        this.loadStatus();
      },
      error: (err) => (this.error = err.error?.message || 'Code invalide.'),
    });
  }

  disable(): void {
    this.error = null;
    const payload: { password?: string; code?: string } = {};
    if (this.disablePassword) payload.password = this.disablePassword;
    if (this.disableCode) payload.code = this.disableCode;
    this.auth.twoFactorDisable(payload).subscribe({
      next: () => {
        this.status = { enabled: false, verified: false, createdAt: null, backupCodesRemaining: 0 };
        this.disablePassword = '';
        this.disableCode = '';
        this.success = 'Double authentification désactivée.';
      },
      error: (err) => (this.error = err.error?.message || 'Désactivation refusée.'),
    });
  }
}

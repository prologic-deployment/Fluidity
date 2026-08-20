import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TwoFactorStatus, LoginActivity } from '../../models/user.model';

/**
 * Page Sécurité :
 *   1. Mot de passe (actuel + nouveau + confirmation, jauge de robustesse,
 *      affichage/masquage) — validation client ET serveur ;
 *   2. Double authentification (TOTP) ;
 *   3. Activité de connexion récente : journal d'audit paginé avec mise en
 *      évidence de la session courante.
 * Un score de posture synthétise l'état réel du compte.
 */
@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './security-page.component.html',
})
export class SecurityPageComponent implements OnInit {
  passwordForm!: FormGroup;
  savingPassword = false;
  showCurrent = false;
  showNew = false;
  showConfirm = false;

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

  // Login activity (paginé)
  activities: LoginActivity[] = [];
  activityTotal = 0;
  activityPage = 1;
  activityPages = 1;
  activityLoading = true;
  activityError: string | null = null;
  sessionIatActuel: number | null = null;
  readonly activityPerPage = 6;

  constructor(private fb: FormBuilder, private auth: AuthService) {}

  ngOnInit(): void {
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: [this.passwordsMatchValidator] }
    );
    this.loadStatus();
    this.loadActivity(1);
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

  loadActivity(page: number): void {
    this.activityLoading = true;
    this.activityError = null;
    this.auth.loginActivity(page, this.activityPerPage).subscribe({
      next: (r) => {
        this.activities = r.activites;
        this.activityTotal = r.total;
        this.activityPage = r.page;
        this.activityPages = r.pages;
        this.sessionIatActuel = r.sessionIatActuel;
        this.activityLoading = false;
      },
      error: () => {
        this.activities = [];
        this.activityError = "Le journal d'activité est momentanément indisponible.";
        this.activityLoading = false;
      },
    });
  }

  // --- Mot de passe ----------------------------------------------------------

  private passwordsMatchValidator(form: FormGroup) {
    const { newPassword, confirmPassword } = form.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  get strengthScore(): number {
    const pwd = this.passwordForm?.value?.newPassword || '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return Math.min(score, 4);
  }

  get strengthLabel(): string {
    return ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'][this.strengthScore] || '';
  }

  get strengthClass(): string {
    return ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-warning', 'bg-success'][this.strengthScore];
  }

  submitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPassword = true;
    this.error = null;
    this.success = null;
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    this.auth.changePassword(currentPassword, newPassword, confirmPassword).subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordForm.reset();
        this.success = 'Mot de passe modifié avec succès.';
      },
      error: (err) => {
        this.savingPassword = false;
        this.error = err.error?.message || 'Erreur lors du changement de mot de passe.';
      },
    });
  }

  // --- 2FA -------------------------------------------------------------------

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

  // --- Activité + score ------------------------------------------------------

  isCurrentSession(a: LoginActivity): boolean {
    return !!a.succes && a.sessionIat != null && a.sessionIat === this.sessionIatActuel;
  }

  formatActivityDate(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  get securityScore(): number {
    const s = this.status;
    if (!s) return 0;
    let score = 40;
    if (s.enabled) score += 40;
    if (s.enabled && (s.backupCodesRemaining ?? 0) > 0) score += 20;
    return score;
  }

  get securityScoreLabel(): string {
    if (this.securityScore >= 90) return 'Excellente posture de sécurité.';
    if (this.securityScore >= 60) return 'Bonne posture — la double authentification est recommandée.';
    return 'À renforcer : activez la double authentification.';
  }

  get securityScoreClass(): string {
    if (this.securityScore >= 90) return 'bg-success';
    if (this.securityScore >= 60) return 'bg-warning';
    return this.securityScore > 0 ? 'bg-destructive' : 'bg-muted';
  }

  get recommendations(): { ok: boolean; text: string }[] {
    const twoFaOn = this.status?.enabled === true;
    return [
      {
        ok: twoFaOn,
        text: twoFaOn
          ? 'Double authentification activée sur ce compte.'
          : 'Activez la double authentification pour protéger votre compte.',
      },
      {
        ok: (this.status?.backupCodesRemaining ?? 0) > 0 || !twoFaOn,
        text: twoFaOn
          ? 'Conservez vos codes de secours dans un endroit sûr.'
          : 'Après activation, conservez vos codes de secours.',
      },
      {
        ok: true,
        text: 'Utilisez un mot de passe unique d’au moins 12 caractères.',
      },
      {
        ok: false,
        text: 'Ne partagez jamais votre mot de passe — le support ne vous le demandera jamais.',
      },
    ];
  }
}

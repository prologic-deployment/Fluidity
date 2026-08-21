import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import {
  Changement,
  displayStockageType,
  displayStockageProtocole,
  normalizeStockage,
} from '../../models/changement.model';
import {
  CHANGEMENT_TRANSITIONS,
  CHANGEMENT_STATUTS_ORDER,
  CHANGEMENT_STATUTS_BRANCHES,
  availableTransitions,
} from '../../models/workflow';
import { WorkflowStepperComponent } from '../shared/workflow-stepper.component';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-changement-details',
  standalone: true,
  imports: [CommonModule, RouterLink, WorkflowStepperComponent],
  templateUrl: './changement-details.component.html',
})
export class ChangementDetailsComponent implements OnInit {
  changement: Changement | null = null;
  loading = true;
  error: string | null = null;

  transitionLoading = false;
  transitionError: string | null = null;

  readonly statutsOrder = CHANGEMENT_STATUTS_ORDER;
  readonly statutsBranches = CHANGEMENT_STATUTS_BRANCHES;

  normalizeStockage = normalizeStockage;
  displayStockageType = displayStockageType;
  displayStockageProtocole = displayStockageProtocole;

  constructor(
    private changementService: ChangementService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BreadcrumbService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.load(id);
    });
  }

  load(id: string): void {
    this.loading = true;
    this.error = null;
    this.changementService.getById(id).subscribe({
      next: (c) => {
        this.changement = c;
        this.loading = false;
        this.breadcrumb.setLabel(this.router.url, c.reference ? `${c.reference} — ${c.objetChangement}` : c.objetChangement);
      },
      error: (err) => {
        this.error = err.error?.message || 'Changement introuvable.';
        this.loading = false;
      },
    });
  }

  // --- Affichage -------------------------------------------------------------

  clientNom(): string {
    const c = this.changement?.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  requesterLabel(): string {
    const r = this.changement?.requester as any;
    if (!r) return '—';
    if (typeof r === 'string') return r;
    return `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '—';
  }

  contratRef(): string {
    const c = this.changement?.contrat as any;
    return c?.reference || (typeof c === 'string' ? c : '—');
  }

  resolveUrl(url?: string): string {
    return resolveUploadUrl(url);
  }

  nomFichier(url: string): string {
    return url.split('/').pop() || url;
  }

  /** Vrai si au moins une section de spécifications contient des données. */
  hasSpecs(specs: Changement['specifications']): boolean {
    if (!specs) return false;
    return Object.keys(specs).some((k) => {
      const v = (specs as Record<string, unknown>)[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.values(v as object).some((x) => x != null && x !== '');
      return true;
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Soumis': return 'badge-outline';
      case 'En attente de validation': return 'badge-secondary';
      case 'Approuvé': return 'badge-secondary';
      case 'Planifié': return 'badge-secondary';
      case "En cours d'implémentation": return 'badge-warning';
      case 'Rollback': return 'badge-destructive';
      case 'Implémenté': return 'badge-success';
      case 'En revue post-implémentation': return 'badge-warning';
      case 'Clôturé': return 'badge-secondary';
      case 'Rejeté': return 'badge-destructive';
      case 'Annulé': return 'badge-secondary';
      default: return 'badge-outline';
    }
  }

  typeClass(type?: string): string {
    switch (type) {
      case 'Urgent': return 'badge-destructive';
      case 'Majeur': return 'badge-warning';
      default: return 'badge-outline';
    }
  }

  // --- Workflow --------------------------------------------------------------

  isOwner(): boolean {
    const r = this.changement?.requester as any;
    const email = typeof r === 'string' ? r : r?.email;
    return this.auth.isClient() && email === this.auth.getEmail();
  }

  canCancel(): boolean {
    return (
      !!this.changement &&
      this.isOwner() &&
      availableTransitions(CHANGEMENT_TRANSITIONS, this.changement.statut, this.auth.getRole()).includes('Annulé')
    );
  }

  prochainesEtapes(): string[] {
    if (!this.changement) return [];
    return availableTransitions(CHANGEMENT_TRANSITIONS, this.changement.statut, this.auth.getRole()).filter(
      (s) => s !== 'Annulé'
    );
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.changement?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.changementService.changerStatut(this.changement._id, nouveauStatut).subscribe({
      next: (updated) => {
        this.changement = updated;
        this.transitionLoading = false;
      },
      error: (err) => {
        this.transitionError = err.error?.message || 'Transition refusée.';
        this.transitionLoading = false;
      },
    });
  }

  async cancelChangement(): Promise<void> {
    if (!this.changement?._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message:
        "Le changement sera marqué comme annulé et sortira définitivement du workflow. Il reste consultable dans l'historique.",
      confirmLabel: 'Annuler le changement',
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.changerStatut(this.changement._id, 'Annulé').subscribe({
      next: (updated) => (this.changement = updated),
      error: (err) => (this.transitionError = err.error?.message || "Échec de l'annulation."),
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Demande } from '../../models/demande.model';
import {
  DEMANDE_TRANSITIONS,
  DEMANDE_STATUTS_ORDER,
  DEMANDE_STATUTS_BRANCHES,
  availableTransitions,
} from '../../models/workflow';
import { WorkflowStepperComponent } from '../shared/workflow-stepper.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-demande-details',
  standalone: true,
  imports: [CommonModule, RouterLink, WorkflowStepperComponent, TranslatePipe],
  templateUrl: './demande-details.component.html',
})
export class DemandeDetailsComponent implements OnInit {
  demande: Demande | null = null;
  loading = true;
  error: string | null = null;

  transitionLoading = false;
  transitionError: string | null = null;

  readonly statutsOrder = DEMANDE_STATUTS_ORDER;
  readonly statutsBranches = DEMANDE_STATUTS_BRANCHES;

  constructor(
    private demandeService: DemandeService,
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
    this.demandeService.getById(id).subscribe({
      next: (d) => {
        this.demande = d;
        this.loading = false;
        this.breadcrumb.setLabel(this.router.url, d.reference ? `${d.reference} — ${d.objet}` : d.objet);
      },
      error: (err) => {
        this.error = err.error?.message || 'Demande introuvable.';
        this.loading = false;
      },
    });
  }

  // --- Affichage -------------------------------------------------------------

  clientNom(): string {
    const c = this.demande?.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  requesterLabel(): string {
    const r = this.demande?.requester as any;
    if (!r) return '—';
    if (typeof r === 'string') return r;
    return `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '—';
  }

  contratRef(): string {
    const c = this.demande?.contrat as any;
    return c?.reference || (typeof c === 'string' ? c : '—');
  }

  resolveUrl(url?: string): string {
    return resolveUploadUrl(url);
  }

  nomFichier(url: string): string {
    return url.split('/').pop() || url;
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Ouverte': return 'badge-outline';
      case "En cours d'analyse": return 'badge-secondary';
      case 'En attente de validation': return 'badge-secondary';
      case 'En cours de réalisation': return 'badge-warning';
      case 'En attente client': return 'badge-warning';
      case 'Réalisée': return 'badge-success';
      case 'Clôturée': return 'badge-secondary';
      case 'Rejetée': return 'badge-destructive';
      case 'Annulé': return 'badge-secondary';
      default: return 'badge-outline';
    }
  }

  prioriteClass(priorite?: string): string {
    switch (priorite) {
      case 'Urgente': return 'badge-destructive';
      case 'Élevée': return 'badge-warning';
      default: return 'badge-outline';
    }
  }

  // --- Workflow --------------------------------------------------------------

  isOwner(): boolean {
    const r = this.demande?.requester as any;
    const email = typeof r === 'string' ? r : r?.email;
    return this.auth.isClient() && email === this.auth.getEmail();
  }

  canCancel(): boolean {
    return (
      !!this.demande &&
      this.isOwner() &&
      availableTransitions(DEMANDE_TRANSITIONS, this.demande.statut, this.auth.getRole()).includes('Annulé')
    );
  }

  prochainesEtapes(): string[] {
    if (!this.demande) return [];
    return availableTransitions(DEMANDE_TRANSITIONS, this.demande.statut, this.auth.getRole()).filter(
      (s) => s !== 'Annulé'
    );
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.demande?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.demandeService.changerStatut(this.demande._id, nouveauStatut).subscribe({
      next: (updated) => {
        this.demande = updated;
        this.transitionLoading = false;
      },
      error: (err) => {
        this.transitionError = err.error?.message || 'Transition refusée.';
        this.transitionLoading = false;
      },
    });
  }

  async cancelDemande(): Promise<void> {
    if (!this.demande?._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message:
        "La demande sera marquée comme annulée et sortira définitivement du workflow. Elle reste consultable dans l'historique.",
      confirmLabel: 'Annuler la demande',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.changerStatut(this.demande._id, 'Annulé').subscribe({
      next: (updated) => (this.demande = updated),
      error: (err) => (this.transitionError = err.error?.message || "Échec de l'annulation."),
    });
  }
}

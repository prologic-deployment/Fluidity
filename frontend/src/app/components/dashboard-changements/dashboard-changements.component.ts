import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement } from '../../models/changement.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { CHANGEMENT_TRANSITIONS, availableTransitions } from '../../models/workflow';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  loading = false;
  error: string | null = null;
  active = 'changements';
  selected: Changement | null = null;
  transitionLoading = false;
  transitionError: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  typeFiltre = '';

  readonly statutsFiltrables = [
    'Soumis',
    'En attente de validation',
    'Approuvé',
    'Planifié',
    "En cours d'implémentation",
    'Implémenté',
    'En revue post-implémentation',
    'Rollback',
    'Clôturé',
    'Rejeté',
    'Annulé',
  ];
  readonly typesFiltrables = ['Normal', 'Majeur', 'Urgent'];

  /** Statuts depuis lesquels le client propriétaire peut annuler son changement. */
  readonly statutsAnnulables = ['Soumis', 'En attente de validation', 'Approuvé', 'Planifié'];

  constructor(
    private changementService: ChangementService,
    public auth: AuthService,
    private router: Router,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.changementService.getAll().subscribe({
      next: (data) => {
        this.changements = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des changements.';
        this.loading = false;
      },
    });
  }

  filteredChangements(): Changement[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.changements.filter((c) => {
      const matchTerm =
        !term ||
        c.objetChangement.toLowerCase().includes(term) ||
        c.clientId?.toLowerCase().includes(term) ||
        c.categorie.toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || c.statut === this.statutFiltre;
      const matchType = !this.typeFiltre || c.typeChangement === this.typeFiltre;
      return matchTerm && matchStatut && matchType;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.typeFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.typeFiltre = '';
  }

  viewDetails(changement: Changement): void {
    this.selected = changement;
    this.transitionError = null;
  }

  closeDetails(): void {
    this.selected = null;
    this.transitionError = null;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Le client connecté est le propriétaire du changement. */
  isOwner(changement: Changement): boolean {
    return this.auth.isClient() && changement.clientId === this.auth.getEmail();
  }

  /**
   * Annulation possible uniquement : client propriétaire + statut précoce.
   * (Un dossier « Annulé » est figé : aucune action n'est plus proposée.)
   */
  isAnnulable(changement: Changement): boolean {
    return this.isOwner(changement) && !!changement.statut && this.statutsAnnulables.includes(changement.statut);
  }

  /**
   * « Annuler » remplace la suppression pour un client : le dossier reste en
   * base, visible dans l'historique, et passe au statut « Annulé » (état final).
   */
  async annulerChangement(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message:
        'Le changement sera conservé dans l\'historique avec le statut « Annulé ». Cette action est définitive : aucune reprise ne sera possible.',
      confirmLabel: 'Annuler le changement',
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.annuler(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de l\'annulation.'),
    });
  }

  /** Statuts vers lesquels le rôle courant peut faire transiter le changement sélectionné. */
  prochainesEtapes(): string[] {
    if (!this.selected) return [];
    return availableTransitions(CHANGEMENT_TRANSITIONS, this.selected.statut, this.auth.getRole());
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.selected?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.changementService.changerStatut(this.selected._id, nouveauStatut).subscribe({
      next: (updated) => {
        this.selected = updated;
        this.transitionLoading = false;
        this.load();
      },
      error: (err) => {
        this.transitionError = err.error?.message || 'Transition refusée.';
        this.transitionLoading = false;
      },
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Soumis':
        return 'badge-outline';
      case 'En attente de validation':
        return 'badge-secondary';
      case 'Approuvé':
        return 'badge-secondary';
      case 'Planifié':
        return 'badge-secondary';
      case "En cours d'implémentation":
        return 'badge-warning';
      case 'Rollback':
        return 'badge-destructive';
      case 'Implémenté':
        return 'badge-success';
      case 'En revue post-implémentation':
        return 'badge-warning';
      case 'Clôturé':
        return 'badge-secondary';
      case 'Rejeté':
        return 'badge-destructive';
      case 'Annulé':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }

  typeClass(type?: string): string {
    switch (type) {
      case 'Urgent':
        return 'badge-destructive';
      case 'Majeur':
        return 'badge-warning';
      default:
        return 'badge-outline';
    }
  }
}

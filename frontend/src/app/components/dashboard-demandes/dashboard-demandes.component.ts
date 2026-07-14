import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DEMANDE_TRANSITIONS, availableTransitions } from '../../models/workflow';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;
  selected: Demande | null = null;
  transitionLoading = false;
  transitionError: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  prioriteFiltre = '';

  readonly statutsFiltrables = [
    'Ouverte',
    "En cours d'analyse",
    'En attente de validation',
    'En cours de réalisation',
    'En attente client',
    'Réalisée',
    'Clôturée',
    'Rejetée',
  ];
  readonly prioritesFiltrables = ['Standard', 'Élevée', 'Urgente'];

  constructor(
    private demandeService: DemandeService,
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
    this.demandeService.getAll().subscribe({
      next: (data) => {
        this.demandes = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des demandes.';
        this.loading = false;
      },
    });
  }

  /** Liste filtrée (recherche texte + statut + priorité), la plus récente en premier. */
  filteredDemandes(): Demande[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.demandes.filter((d) => {
      const matchTerm =
        !term ||
        d.objet.toLowerCase().includes(term) ||
        d.clientId?.toLowerCase().includes(term) ||
        d.categorie.toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || d.statut === this.statutFiltre;
      const matchPriorite = !this.prioriteFiltre || d.prioriteSouhaitee === this.prioriteFiltre;
      return matchTerm && matchStatut && matchPriorite;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.prioriteFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.prioriteFiltre = '';
  }

  viewDetails(demande: Demande): void {
    this.selected = demande;
    this.transitionError = null;
  }

  closeDetails(): void {
    this.selected = null;
    this.transitionError = null;
  }

  /** Seul le client propriétaire de la demande peut la supprimer (ADMIN excepté). */
  isOwner(demande: Demande): boolean {
    return this.auth.isClient() && demande.clientId === this.auth.getEmail();
  }

  async deleteDemande(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer cette demande ?',
      message: 'Cette action est définitive et ne pourra pas être annulée.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  /** Statuts vers lesquels le rôle courant peut faire transiter la demande sélectionnée. */
  prochainesEtapes(): string[] {
    if (!this.selected) return [];
    return availableTransitions(DEMANDE_TRANSITIONS, this.selected.statut, this.auth.getRole());
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.selected?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.demandeService.changerStatut(this.selected._id, nouveauStatut).subscribe({
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

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Retourne la classe de badge (shadcn) selon le statut. */
  statutClass(statut?: string): string {
    switch (statut) {
      case 'Ouverte':
        return 'badge-outline';
      case 'En cours d\'analyse':
        return 'badge-secondary';
      case 'En attente de validation':
        return 'badge-secondary';
      case 'En cours de réalisation':
        return 'badge-warning';
      case 'En attente client':
        return 'badge-warning';
      case 'Réalisée':
        return 'badge-success';
      case 'Clôturée':
        return 'badge-secondary';
      case 'Rejetée':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }

  prioriteClass(priorite?: string): string {
    switch (priorite) {
      case 'Urgente':
        return 'badge-destructive';
      case 'Élevée':
        return 'badge-warning';
      default:
        return 'badge-outline';
    }
  }
}

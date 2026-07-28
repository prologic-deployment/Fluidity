import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DemandeService } from '../../services/demande.service';
import { AuthService } from '../../services/auth.service';
import { Demande, StatutDemande } from '../../models/demande.model';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { RouterLink } from '@angular/router';
import { WorkflowActionsComponent } from '../shared/workflow-actions.component';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, WorkflowActionsComponent],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  filteredDemandes: Demande[] = [];
  selectedDemande: Demande | null = null;
  loading = true;
  error: string | null = null;

  recherche = '';
  statutFiltre: string = '';
  readonly statutsFiltrables = [
    'Ouverte',
    "En cours d'analyse",
    'En attente de validation',
    'En cours de réalisation',
    'En attente client',
    'Réalisée',
    'Clôturée',
    'Rejetée',
    'Annulée',
  ];

  sortKey: keyof Demande = 'createdAt';
  sortAsc = false;

  constructor(
    private demandeService: DemandeService,
    private auth: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.demandeService.getAll().subscribe({
      next: (data) => {
        this.demandes = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les demandes.';
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    let result = [...this.demandes];
    if (this.recherche.trim()) {
      const q = this.recherche.toLowerCase();
      result = result.filter(
        (d) =>
          d.objet?.toLowerCase().includes(q) ||
          d.typeDemande?.toLowerCase().includes(q) ||
          d.statut?.toLowerCase().includes(q)
      );
    }
    if (this.statutFiltre) {
      result = result.filter((d) => d.statut === this.statutFiltre);
    }
    result.sort((a, b) => {
      const va = a[this.sortKey] ?? '';
      const vb = b[this.sortKey] ?? '';
      if (va < vb) return this.sortAsc ? -1 : 1;
      if (va > vb) return this.sortAsc ? 1 : -1;
      return 0;
    });
    this.filteredDemandes = result;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatutChange(): void {
    this.applyFilters();
  }

  toggleSort(key: keyof Demande): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.applyFilters();
  }

  sortIcon(key: keyof Demande): string {
    if (this.sortKey !== key) return '↕';
    return this.sortAsc ? '↑' : '↓';
  }

  openDetails(demande: Demande): void {
    this.selectedDemande = demande;
  }

  closeDetails(): void {
    this.selectedDemande = null;
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  /** Seul le client propriétaire de la demande peut agir (ADMIN excepté). */
  isOwner(demande: Demande): boolean {
    return this.auth.isClient() && demande.clientId === this.auth.getEmail();
  }

  canCancel(demande: Demande): boolean {
    return this.isOwner(demande) && demande.statut !== 'Annulée';
  }

  canDelete(demande: Demande): boolean {
    return !this.auth.isClient() && (this.auth.isAdmin() || demande.clientId === this.auth.getEmail());
  }

  statutClass(statut: StatutDemande | undefined): string {
    switch (statut) {
      case 'Ouverte':
        return 'badge-default';
      case 'En cours de réalisation':
        return 'badge-blue';
      case 'En attente de validation':
        return 'badge-yellow';
      case 'En attente client':
        return 'badge-orange';
      case 'Réalisée':
        return 'badge-green';
      case 'Clôturée':
        return 'badge-muted';
      case 'Rejetée':
        return 'badge-destructive';
      case 'Annulée':
        return 'badge-muted';
      default:
        return 'badge-default';
    }
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

  async cancelDemande(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message: "La demande restera visible dans l'historique mais ne pourra plus être traitée.",
      confirmLabel: 'Annuler la demande',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.cancel(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || "Échec de l'annulation."),
    });
  }
}

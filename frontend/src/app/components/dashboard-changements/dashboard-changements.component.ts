import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ChangementService } from '../../services/changement.service';
import { AuthService } from '../../services/auth.service';
import { Changement, StatutChangement } from '../../models/changement.model';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { RouterLink } from '@angular/router';
import { WorkflowActionsComponent } from '../shared/workflow-actions.component';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, WorkflowActionsComponent],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  filteredChangements: Changement[] = [];
  selectedChangement: Changement | null = null;
  loading = true;
  error: string | null = null;

  recherche = '';
  statutFiltre: string = '';
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

  sortKey: keyof Changement = 'createdAt';
  sortAsc = false;

  constructor(
    private changementService: ChangementService,
    private auth: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.changementService.getAll().subscribe({
      next: (data) => {
        this.changements = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les changements.';
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    let result = [...this.changements];
    if (this.recherche.trim()) {
      const q = this.recherche.toLowerCase();
      result = result.filter(
        (c) =>
          c.objetChangement?.toLowerCase().includes(q) ||
          c.typeChangement?.toLowerCase().includes(q) ||
          c.statut?.toLowerCase().includes(q)
      );
    }
    if (this.statutFiltre) {
      result = result.filter((c) => c.statut === this.statutFiltre);
    }
    result.sort((a, b) => {
      const va = a[this.sortKey] ?? '';
      const vb = b[this.sortKey] ?? '';
      if (va < vb) return this.sortAsc ? -1 : 1;
      if (va > vb) return this.sortAsc ? 1 : -1;
      return 0;
    });
    this.filteredChangements = result;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatutChange(): void {
    this.applyFilters();
  }

  toggleSort(key: keyof Changement): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.applyFilters();
  }

  sortIcon(key: keyof Changement): string {
    if (this.sortKey !== key) return '↕';
    return this.sortAsc ? '↑' : '↓';
  }

  openDetails(changement: Changement): void {
    this.selectedChangement = changement;
  }

  closeDetails(): void {
    this.selectedChangement = null;
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  /** Seul le client propriétaire du changement peut agir (ADMIN excepté). */
  isOwner(changement: Changement): boolean {
    return this.auth.isClient() && changement.clientId === this.auth.getEmail();
  }

  canCancel(changement: Changement): boolean {
    return this.isOwner(changement) && changement.statut !== 'Annulé';
  }

  canDelete(changement: Changement): boolean {
    return !this.auth.isClient() && (this.auth.isAdmin() || changement.clientId === this.auth.getEmail());
  }

  statutClass(statut: StatutChangement | undefined): string {
    switch (statut) {
      case 'Soumis':
        return 'badge-default';
      case 'En attente de validation':
        return 'badge-yellow';
      case 'Approuvé':
        return 'badge-green';
      case 'Planifié':
        return 'badge-blue';
      case "En cours d'implémentation":
        return 'badge-blue';
      case 'Implémenté':
        return 'badge-green';
      case 'En revue post-implémentation':
        return 'badge-orange';
      case 'Rollback':
        return 'badge-destructive';
      case 'Clôturé':
        return 'badge-muted';
      case 'Rejeté':
        return 'badge-destructive';
      case 'Annulé':
        return 'badge-muted';
      default:
        return 'badge-default';
    }
  }

  async deleteChangement(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer ce changement ?',
      message: 'Cette action est définitive et ne pourra pas être annulée.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  async cancelChangement(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message: "Le changement restera visible dans l'historique mais ne pourra plus être traité.",
      confirmLabel: 'Annuler le changement',
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.cancel(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || "Échec de l'annulation."),
    });
  }
}

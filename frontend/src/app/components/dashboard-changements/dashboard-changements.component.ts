import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement } from '../../models/changement.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { CHANGEMENT_TRANSITIONS, availableTransitions } from '../../models/workflow';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalComponent],
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

  constructor(
    private changementService: ChangementService,
    private auth: AuthService,
    private router: Router
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

  deleteChangement(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Confirmer la suppression de ce changement ?')) return;
    this.changementService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
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

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;
  selected: Demande | null = null;

  constructor(
    private demandeService: DemandeService,
    private auth: AuthService,
    private router: Router
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

  viewDetails(demande: Demande): void {
    this.selected = demande;
  }

  closeDetails(): void {
    this.selected = null;
  }

  deleteDemande(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Confirmer la suppression de cette demande ?')) return;
    this.demandeService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
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
      case 'En cours de traitement':
        return 'badge-warning';
      case 'Résolue':
        return 'badge-success';
      case 'Fermée':
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

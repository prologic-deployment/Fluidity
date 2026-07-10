import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande } from '../../models/demande.model';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;

  constructor(private demandeService: DemandeService) {}

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

  deleteDemande(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Confirmer la suppression de cette demande ?')) return;
    this.demandeService.delete(id).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  /** Retourne la classe Tailwind selon le statut. */
  statutClass(statut?: string): string {
    switch (statut) {
      case 'Ouverte':
        return 'bg-blue-100 text-blue-700';
      case 'En cours d\'analyse':
        return 'bg-indigo-100 text-indigo-700';
      case 'En cours de traitement':
        return 'bg-amber-100 text-amber-700';
      case 'Résolue':
        return 'bg-green-100 text-green-700';
      case 'Fermée':
        return 'bg-slate-200 text-slate-600';
      case 'Rejetée':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  prioriteClass(priorite?: string): string {
    switch (priorite) {
      case 'Urgente':
        return 'bg-red-100 text-red-700';
      case 'Élevée':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }
}

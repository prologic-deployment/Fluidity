import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { Contrat } from '../../models/contrat.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-dashboard-contrats',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-contrats.component.html',
})
export class DashboardContratsComponent implements OnInit {
  contrats: Contrat[] = [];
  loading = false;
  error: string | null = null;
  selected: Contrat | null = null;

  constructor(
    private contratService: ContratService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.contratService.getAll().subscribe({
      next: (data) => {
        this.contrats = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des contrats.';
        this.loading = false;
      },
    });
  }

  viewDetails(contrat: Contrat): void {
    this.selected = contrat;
  }

  closeDetails(): void {
    this.selected = null;
  }

  deleteContrat(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Confirmer la suppression de ce contrat ?')) return;
    this.contratService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Actif':
        return 'badge-success';
      case 'Suspendu':
        return 'badge-warning';
      case 'Expiré':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { Contrat } from '../../models/contrat.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

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
    public auth: AuthService,
    private confirmDialog: ConfirmDialogService
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

  async deleteContrat(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer ce contrat ?',
      message: 'Cette action est définitive et ne pourra pas être annulée.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
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

  accentClass(statut?: string): string {
    switch (statut) {
      case 'Actif':
        return 'accent-bar-success';
      case 'Suspendu':
        return 'accent-bar-warning';
      case 'Expiré':
        return 'accent-bar-destructive';
      default:
        return 'accent-bar-default';
    }
  }
}

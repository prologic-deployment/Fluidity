import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientService } from '../../services/client.service';
import { Client, STATUTS_CLIENT } from '../../models/client.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-dashboard-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-clients.component.html',
})
export class DashboardClientsComponent implements OnInit {
  clients: Client[] = [];
  loading = false;
  error: string | null = null;
  selected: Client | null = null;

  searchTerm = '';
  statutFiltre = '';
  readonly statutsFiltrables = STATUTS_CLIENT;

  constructor(
    private clientService: ClientService,
    public auth: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.clientService.getAll().subscribe({
      next: (data) => {
        this.clients = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des clients.';
        this.loading = false;
      },
    });
  }

  filteredClients(): Client[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.clients.filter((c) => {
      const matchTerm =
        !term || c.nom.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || c.statut === this.statutFiltre;
      return matchTerm && matchStatut;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
  }

  viewDetails(client: Client): void {
    this.selected = client;
  }

  closeDetails(): void {
    this.selected = null;
  }

  statutClass(statut?: string): string {
    return statut === 'Actif' ? 'badge-success' : 'badge-secondary';
  }

  async deleteClient(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer ce client ?',
      message: 'Cette action est définitive. Les contrats déjà rattachés à ce client ne seront pas supprimés.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.clientService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }
}

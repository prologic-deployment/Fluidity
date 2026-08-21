import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { ClientService } from '../../services/client.service';
import { Contrat, STATUTS_CONTRAT } from '../../models/contrat.model';
import { Client } from '../../models/client.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-dashboard-contrats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-contrats.component.html',
})
export class DashboardContratsComponent implements OnInit {
  contrats: Contrat[] = [];
  clients: Client[] = [];
  loading = false;
  error: string | null = null;
  selected: Contrat | null = null;
  assignClientId = '';
  assignLoading = false;

  searchTerm = '';
  statutFiltre = '';
  readonly statutsFiltrables = STATUTS_CONTRAT;

  constructor(
    private contratService: ContratService,
    private clientService: ClientService,
    public auth: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.load();
    if (this.auth.isAdmin()) this.loadClients();
  }

  loadClients(): void {
    this.clientService.getAll().subscribe({
      next: (data) => (this.clients = data),
      error: () => (this.clients = []),
    });
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

  /** Libellé du client (peuplé côté serveur). */
  clientNom(c: Contrat): string {
    const cl = c.clientId as any;
    return cl?.nom || (typeof cl === 'string' ? cl : '—');
  }

  clientEmail(c: Contrat): string {
    const cl = c.clientId as any;
    return cl?.email || (typeof cl === 'string' ? cl : '');
  }

  filteredContrats(): Contrat[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.contrats.filter((c) => {
      const matchTerm =
        !term ||
        c.intitule.toLowerCase().includes(term) ||
        c.reference.toLowerCase().includes(term) ||
        this.clientNom(c).toLowerCase().includes(term);
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

  viewDetails(contrat: Contrat): void {
    this.selected = contrat;
    const cl = contrat.clientId as any;
    this.assignClientId = cl?._id || (typeof cl === 'string' ? cl : '');
  }

  closeDetails(): void {
    this.selected = null;
    this.assignClientId = '';
  }

  /** L'admin affecte/change le client rattaché au contrat. */
  assignClient(): void {
    if (!this.selected?._id || !this.assignClientId) return;
    this.assignLoading = true;
    this.error = null;
    this.contratService.update(this.selected._id, { clientId: this.assignClientId }).subscribe({
      next: () => {
        this.assignLoading = false;
        this.load();
        const sel = this.selected;
        this.closeDetails();
        // Ré-ouvre le détail mis à jour
        const updated = this.contrats.find((c) => c._id === sel?._id);
        if (updated) this.viewDetails(updated);
      },
      error: (err) => {
        this.assignLoading = false;
        this.error = err.error?.message || 'Échec de l’affectation du client.';
      },
    });
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

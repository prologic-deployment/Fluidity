import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientService, IdentifiantsPortail } from '../../services/client.service';
import { Client, STATUTS_CLIENT } from '../../models/client.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { CredentialsModalComponent } from '../shared/credentials-modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-dashboard-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, CredentialsModalComponent],
  templateUrl: './dashboard-clients.component.html',
})
export class DashboardClientsComponent implements OnInit {
  clients: Client[] = [];
  loading = false;
  error: string | null = null;
  selected: Client | null = null;
  /** Identifiants fraîchement régénérés — affichés une seule fois. */
  identifiants: IdentifiantsPortail | null = null;
  regenerationEnCours = false;

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

  /**
   * Régénération de l'accès portail (mot de passe provisoire perdu, accès à
   * ré-émettre) : l'ancien mot de passe est définitivement invalidé et le
   * remplacement est exigé à la prochaine connexion. Les nouveaux
   * identifiants ne sont affichables qu'une seule fois.
   */
  async regenererAcces(client: Client): Promise<void> {
    if (!client._id || this.regenerationEnCours) return;
    const ok = await this.confirmDialog.confirm({
      title: "Régénérer l'accès portail ?",
      message:
        "L'ancien mot de passe de « " + client.nom + " » sera définitivement invalidé. " +
        'Le client devra remplacer le nouveau mot de passe provisoire à sa prochaine connexion.',
      confirmLabel: "Régénérer l'accès",
    });
    if (!ok) return;
    this.regenerationEnCours = true;
    this.clientService.regenererAcces(client._id).subscribe({
      next: (resp) => {
        this.regenerationEnCours = false;
        this.closeDetails();
        this.identifiants = resp.identifiants || null;
        this.load(); // mustChangePassword repasse à true côté fiche
      },
      error: (err) => {
        this.regenerationEnCours = false;
        this.error = err.error?.message || "Échec de la régénération de l'accès.";
      },
    });
  }

  fermerIdentifiants(): void {
    this.identifiants = null;
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

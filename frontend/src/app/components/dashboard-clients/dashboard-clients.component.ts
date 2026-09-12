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
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-dashboard-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, CredentialsModalComponent, ...I18N_IMPORTS],
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

  // --- Pagination serveur (PERF-002) ------------------------------------------
  page = 1;
  pages = 1;
  total = 0;
  readonly limitePage = 50;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  searchTerm = '';
  statutFiltre = '';
  readonly statutsFiltrables = STATUTS_CLIENT;

  constructor(
    private clientService: ClientService,
    public auth: AuthService,
    private confirmDialog: ConfirmDialogService
  ,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.clientService
      .getPage({
        page: this.page,
        limit: this.limitePage,
        statut: this.statutFiltre || undefined,
        recherche: this.searchTerm.trim() || undefined,
        tri: 'nom',
        dir: 'asc',
      })
      .subscribe({
        next: (data) => {
          this.clients = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Erreur de chargement des clients.';
          this.loading = false;
        },
      });
  }

  /** Recherche avec anti-rebond (300 ms) — filtrage côté serveur (PERF-002). */
  onSearchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  onFiltersChanged(): void {
    this.page = 1;
    this.load();
  }

  allerPage(p: number): void {
    if (p >= 1 && p <= this.pages && p !== this.page) {
      this.page = p;
      this.load();
    }
  }

  /** Liste courante : filtrage + pagination appliqués CÔTÉ SERVEUR (PERF-002). */
  filteredClients(): Client[] {
    return this.clients;
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.onFiltersChanged();
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
        this.error = apiErrorMessage(this.i18n, err, 'clients.regenerateError');
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
      message: this.i18n.t('clients.deleteMessage'),
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.clientService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'clients.deleteError')),
    });
  }
}

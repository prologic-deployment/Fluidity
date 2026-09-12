import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContratService } from '../../services/contrat.service';
import { Contrat, STATUTS_CONTRAT } from '../../models/contrat.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-dashboard-contrats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './dashboard-contrats.component.html',
})
export class DashboardContratsComponent implements OnInit {
  contrats: Contrat[] = [];
  loading = false;
  error: string | null = null;
  selected: Contrat | null = null;

  // --- Pagination serveur (PERF-002) ------------------------------------------
  page = 1;
  pages = 1;
  total = 0;
  readonly limitePage = 50;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  searchTerm = '';
  statutFiltre = '';
  readonly statutsFiltrables = STATUTS_CONTRAT;

  constructor(
    private contratService: ContratService,
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
    this.contratService
      .getPage({
        page: this.page,
        limit: this.limitePage,
        statut: this.statutFiltre || undefined,
        recherche: this.searchTerm.trim() || undefined,
        tri: 'date',
        dir: 'desc',
      })
      .subscribe({
        next: (data) => {
          this.contrats = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Erreur de chargement des contrats.';
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
  filteredContrats(): Contrat[] {
    return this.contrats;
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.onFiltersChanged();
  }

  viewDetails(contrat: Contrat): void {
    this.selected = contrat;
  }

  closeDetails(): void {
    this.selected = null;
  }

  /** Nom de la fiche client (référence ObjectId peuplée côté serveur). */
  clientNom(contrat: Contrat): string {
    const cl = contrat.clientId;
    if (cl && typeof cl === 'object') return cl.nom;
    return (cl as string) || '—';
  }

  /** Email de la fiche client, quand la référence est peuplée. */
  clientEmail(contrat: Contrat): string {
    const cl = contrat.clientId;
    return cl && typeof cl === 'object' ? cl.email || '' : '';
  }

  async deleteContrat(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer ce contrat ?',
      message: this.i18n.t('contracts.deleteMessage'),
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.contratService.delete(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'contracts.deleteError')),
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

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement } from '../../models/changement.model';
import { CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { StatCardComponent } from '../shared/stat-card.component';
import { CHANGEMENT_TRANSITIONS, availableTransitions } from '../../models/workflow';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatCardComponent],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  loading = false;
  error: string | null = null;

  filterReference = '';
  filterObjet = '';
  filterClient = '';
  statutFiltre = '';
  typeFiltre = '';
  categorieFiltre = '';
  sousCategorieFiltre = '';
  filterDateFrom = '';
  readonly categories = CATEGORIES;

  readonly statutsFiltrables = [
    'Soumis',
    'En attente de validation',
    'Approuvé',
    'Planifié',
    "En cours d'implémentation",
    'Implémenté',
    'En revue post-implémentation',
    'Rollback',
    'Clôturé',
    'Rejeté',
    'Annulé',
  ];
  readonly typesFiltrables = ['Standard', 'Majeur', 'Urgent'];

  constructor(
    private changementService: ChangementService,
    public auth: AuthService,
    private router: Router,
    private confirmDialog: ConfirmDialogService
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

  /** Sous-catégories proposées selon la catégorie filtrée (ou toutes). */
  sousCategoriesOptions(): string[] {
    if (this.categorieFiltre) return SOUS_CATEGORIES[this.categorieFiltre] || [];
    return Object.values(SOUS_CATEGORIES).flat();
  }

  filteredChangements(): Changement[] {
    const ref = this.filterReference.trim().toLowerCase();
    const objet = this.filterObjet.trim().toLowerCase();
    const client = this.filterClient.trim().toLowerCase();
    const from = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
    return this.changements.filter((c) => {
      if (ref && !(c.reference?.toLowerCase().includes(ref) || false)) return false;
      if (objet && !c.objetChangement.toLowerCase().includes(objet)) return false;
      if (client && !this.clientNom(c).toLowerCase().includes(client)) return false;
      if (this.categorieFiltre && c.categorie !== this.categorieFiltre) return false;
      if (this.sousCategorieFiltre && c.sousCategorie !== this.sousCategorieFiltre) return false;
      if (this.typeFiltre && c.typeChangement !== this.typeFiltre) return false;
      if (this.statutFiltre && c.statut !== this.statutFiltre) return false;
      if (from && c.createdAt && new Date(c.createdAt) < from) return false;
      return true;
    });
  }

  /** Statistiques calculées sur les données réelles chargées. */
  stats(): {
    total: number; soumis: number; enValidation: number; approuves: number; enCours: number;
    implementes: number; clotures: number; rejetes: number; annules: number;
  } {
    const count = (s: string) => this.changements.filter((c) => c.statut === s).length;
    return {
      total: this.changements.length,
      soumis: count('Soumis'),
      enValidation: count('En attente de validation'),
      approuves: count('Approuvé') + count('Planifié'),
      enCours: count("En cours d'implémentation"),
      implementes: count('Implémenté'),
      clotures: count('Clôturé'),
      rejetes: count('Rejeté') + count('Rollback'),
      annules: count('Annulé'),
    };
  }

  clientEmail(c: Changement): string {
    const cl = c.clientId as any;
    return cl?.email || '';
  }

  clientAvatar(c: Changement): string {
    const cl = c.clientId as any;
    return cl?.avatarUrl ? resolveUploadUrl(cl.avatarUrl) : '';
  }

  clientInitiales(c: Changement): string {
    return (this.clientNom(c) || '?').trim().slice(0, 2).toUpperCase();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filterReference || this.filterObjet || this.filterClient ||
      this.statutFiltre || this.typeFiltre || this.categorieFiltre ||
      this.sousCategorieFiltre || this.filterDateFrom
    );
  }

  resetFilters(): void {
    this.filterReference = '';
    this.filterObjet = '';
    this.filterClient = '';
    this.statutFiltre = '';
    this.typeFiltre = '';
    this.categorieFiltre = '';
    this.sousCategorieFiltre = '';
    this.filterDateFrom = '';
  }

  /** Navigation vers la page de détail dédiée. */
  openDetails(changement: Changement): void {
    if (changement._id) this.router.navigate(['/changements', changement._id]);
  }

  /** Libellé du client (peuplé côté serveur). */
  clientNom(c: Changement): string {
    const cl = c.clientId as any;
    return cl?.nom || (typeof cl === 'string' ? cl : '—');
  }

  /** Email du demandeur (peuplé côté serveur). */
  requesterEmail(c: Changement): string {
    const r = c.requester as any;
    return r?.email || (typeof r === 'string' ? r : '');
  }

  /** Le client propriétaire peut agir sur son propre changement. */
  isOwner(changement: Changement): boolean {
    return this.auth.isClient() && this.requesterEmail(changement) === this.auth.getEmail();
  }

  /** Le changement peut-il encore être annulé par son client propriétaire ? */
  canCancel(changement: Changement): boolean {
    return (
      this.isOwner(changement) &&
      availableTransitions(CHANGEMENT_TRANSITIONS, changement.statut, this.auth.getRole()).includes('Annulé')
    );
  }

  async cancelChangement(changement: Changement): Promise<void> {
    if (!changement._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message:
        "Le changement sera marqué comme annulé et sortira définitivement du workflow. Il reste consultable dans l'historique.",
      confirmLabel: 'Annuler le changement',
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.changerStatut(changement._id, 'Annulé').subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || "Échec de l'annulation."),
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Soumis': return 'badge-outline';
      case 'En attente de validation': return 'badge-secondary';
      case 'Approuvé': return 'badge-secondary';
      case 'Planifié': return 'badge-secondary';
      case "En cours d'implémentation": return 'badge-warning';
      case 'Rollback': return 'badge-destructive';
      case 'Implémenté': return 'badge-success';
      case 'En revue post-implémentation': return 'badge-warning';
      case 'Clôturé': return 'badge-secondary';
      case 'Rejeté': return 'badge-destructive';
      case 'Annulé': return 'badge-secondary';
      default: return 'badge-outline';
    }
  }

  typeClass(type?: string): string {
    switch (type) {
      case 'Urgent': return 'badge-destructive';
      case 'Majeur': return 'badge-warning';
      default: return 'badge-outline';
    }
  }
}

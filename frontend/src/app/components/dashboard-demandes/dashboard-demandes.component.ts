import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande, CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { StatCardComponent } from '../shared/stat-card.component';
import { DEMANDE_TRANSITIONS, availableTransitions } from '../../models/workflow';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatCardComponent],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;

  filterReference = '';
  filterObjet = '';
  filterClient = '';
  categorieFiltre = '';
  sousCategorieFiltre = '';
  prioriteFiltre = '';
  statutFiltre = '';
  filterDateFrom = '';

  readonly statutsFiltrables = [
    'Ouverte',
    "En cours d'analyse",
    'En attente de validation',
    'En cours de réalisation',
    'En attente client',
    'Réalisée',
    'Clôturée',
    'Rejetée',
    'Annulé',
  ];
  readonly prioritesFiltrables = ['Standard', 'Élevée', 'Urgente'];
  readonly categories = CATEGORIES;

  constructor(
    private demandeService: DemandeService,
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

  /** Libellé du client (peuplé côté serveur). */
  clientNom(d: Demande): string {
    const c = d.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  clientEmail(d: Demande): string {
    const c = d.clientId as any;
    return c?.email || '';
  }

  clientAvatar(d: Demande): string {
    const c = d.clientId as any;
    return c?.avatarUrl ? resolveUploadUrl(c.avatarUrl) : '';
  }

  clientInitiales(d: Demande): string {
    return (this.clientNom(d) || '?').trim().slice(0, 2).toUpperCase();
  }

  /** Email du demandeur (peuplé côté serveur). */
  requesterEmail(d: Demande): string {
    const r = d.requester as any;
    return r?.email || (typeof r === 'string' ? r : '');
  }

  /** Statistiques calculées sur les données réelles chargées. */
  stats(): {
    total: number; ouvertes: number; enCours: number; enAttente: number;
    realisees: number; cloturees: number; rejetees: number; annulees: number;
  } {
    const count = (s: string) => this.demandes.filter((d) => d.statut === s).length;
    return {
      total: this.demandes.length,
      ouvertes: count('Ouverte'),
      enCours: count("En cours d'analyse") + count('En cours de réalisation'),
      enAttente: count('En attente de validation') + count('En attente client'),
      realisees: count('Réalisée'),
      cloturees: count('Clôturée'),
      rejetees: count('Rejetée'),
      annulees: count('Annulé'),
    };
  }

  /** Sous-catégories proposées selon la catégorie filtrée (ou toutes). */
  sousCategoriesOptions(): string[] {
    if (this.categorieFiltre) return SOUS_CATEGORIES[this.categorieFiltre] || [];
    return Object.values(SOUS_CATEGORIES).flat();
  }

  /** Liste filtrée (filtres d'en-tête combinables, côté client). */
  filteredDemandes(): Demande[] {
    const ref = this.filterReference.trim().toLowerCase();
    const objet = this.filterObjet.trim().toLowerCase();
    const client = this.filterClient.trim().toLowerCase();
    const from = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
    return this.demandes.filter((d) => {
      if (ref && !(d.reference?.toLowerCase().includes(ref) || false)) return false;
      if (objet && !d.objet.toLowerCase().includes(objet)) return false;
      if (client && !this.clientNom(d).toLowerCase().includes(client)) return false;
      if (this.categorieFiltre && d.categorie !== this.categorieFiltre) return false;
      if (this.sousCategorieFiltre && d.sousCategorie !== this.sousCategorieFiltre) return false;
      if (this.prioriteFiltre && d.prioriteSouhaitee !== this.prioriteFiltre) return false;
      if (this.statutFiltre && d.statut !== this.statutFiltre) return false;
      if (from && d.createdAt && new Date(d.createdAt) < from) return false;
      return true;
    });
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filterReference || this.filterObjet || this.filterClient ||
      this.categorieFiltre || this.sousCategorieFiltre ||
      this.prioriteFiltre || this.statutFiltre || this.filterDateFrom
    );
  }

  resetFilters(): void {
    this.filterReference = '';
    this.filterObjet = '';
    this.filterClient = '';
    this.categorieFiltre = '';
    this.sousCategorieFiltre = '';
    this.prioriteFiltre = '';
    this.statutFiltre = '';
    this.filterDateFrom = '';
  }

  /** Navigation vers la page de détail dédiée. */
  openDetails(demande: Demande): void {
    if (demande._id) this.router.navigate(['/demandes', demande._id]);
  }

  /** Le client propriétaire peut agir sur sa propre demande. */
  isOwner(demande: Demande): boolean {
    return this.auth.isClient() && this.requesterEmail(demande) === this.auth.getEmail();
  }

  /** La demande peut-elle encore être annulée par son client propriétaire ? */
  canCancel(demande: Demande): boolean {
    return (
      this.isOwner(demande) &&
      availableTransitions(DEMANDE_TRANSITIONS, demande.statut, this.auth.getRole()).includes('Annulé')
    );
  }

  async cancelDemande(demande: Demande): Promise<void> {
    if (!demande._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message:
        "La demande sera marquée comme annulée et sortira définitivement du workflow. Elle reste consultable dans l'historique.",
      confirmLabel: 'Annuler la demande',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.changerStatut(demande._id, 'Annulé').subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || "Échec de l'annulation."),
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Ouverte': return 'badge-outline';
      case "En cours d'analyse": return 'badge-secondary';
      case 'En attente de validation': return 'badge-secondary';
      case 'En cours de réalisation': return 'badge-warning';
      case 'En attente client': return 'badge-warning';
      case 'Réalisée': return 'badge-success';
      case 'Clôturée': return 'badge-secondary';
      case 'Rejetée': return 'badge-destructive';
      case 'Annulé': return 'badge-secondary';
      default: return 'badge-outline';
    }
  }

  prioriteClass(priorite?: string): string {
    switch (priorite) {
      case 'Urgente': return 'badge-destructive';
      case 'Élevée': return 'badge-warning';
      default: return 'badge-outline';
    }
  }
}

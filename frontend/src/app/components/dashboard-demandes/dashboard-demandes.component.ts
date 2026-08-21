import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande, CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { StatCardComponent } from '../shared/stat-card.component';
import { SortHeaderComponent } from '../shared/sort-header.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { DEMANDE_TRANSITIONS, availableTransitions } from '../../models/workflow';
import { resolveUploadUrl } from '../../utils/upload-url.util';

type SortKey = 'reference' | 'objet' | 'client' | 'categorie' | 'priorite' | 'statut' | 'createdAt';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatCardComponent, SortHeaderComponent, TranslatePipe],
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

  sortKey: SortKey | '' = '';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly statutsFiltrables = [
    'Ouverte', "En cours d'analyse", 'En attente de validation', 'En cours de réalisation',
    'En attente client', 'Réalisée', 'Clôturée', 'Rejetée', 'Annulé',
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

  requesterEmail(d: Demande): string {
    const r = d.requester as any;
    return r?.email || (typeof r === 'string' ? r : '');
  }

  stats(): { total: number; ouvertes: number; enCours: number; enAttente: number; realisees: number; cloturees: number; rejetees: number; annulees: number; } {
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

  sousCategoriesOptions(): string[] {
    if (this.categorieFiltre) return SOUS_CATEGORIES[this.categorieFiltre] || [];
    return Object.values(SOUS_CATEGORIES).flat();
  }

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

  sort(key: SortKey): void {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = 'asc'; }
  }

  sortDirFor(key: SortKey): 'asc' | 'desc' | null {
    return this.sortKey === key ? this.sortDir : null;
  }

  private valueOf(d: Demande, key: SortKey): string | number {
    switch (key) {
      case 'reference': return d.reference || '';
      case 'objet': return d.objet.toLowerCase();
      case 'client': return this.clientNom(d).toLowerCase();
      case 'categorie': return (d.categorie + ' ' + d.sousCategorie).toLowerCase();
      case 'priorite': return { Standard: 0, 'Élevée': 1, Urgente: 2 }[d.prioriteSouhaitee] ?? 99;
      case 'statut': return d.statut || '';
      case 'createdAt': return d.createdAt ? new Date(d.createdAt).getTime() : 0;
    }
  }

  displayedDemandes(): Demande[] {
    const filtered = this.filteredDemandes();
    if (!this.sortKey) return filtered;
    const key = this.sortKey;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = this.valueOf(a, key);
      const vb = this.valueOf(b, key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
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

  openDetails(demande: Demande): void {
    if (demande._id) this.router.navigate(['/demandes', demande._id]);
  }

  isOwner(demande: Demande): boolean {
    return this.auth.isClient() && this.requesterEmail(demande) === this.auth.getEmail();
  }

  canCancel(demande: Demande): boolean {
    return this.isOwner(demande) &&
      availableTransitions(DEMANDE_TRANSITIONS, demande.statut, this.auth.getRole()).includes('Annulé');
  }

  async cancelDemande(demande: Demande): Promise<void> {
    if (!demande._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message: "La demande sera marquée comme annulée et sortira définitivement du workflow.",
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

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { StatCardComponent } from '../shared/stat-card.component';
import { Ticket, TicketStats, STATUTS_TICKET } from '../../models/ticket.model';
import { CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-dashboard-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatCardComponent],
  templateUrl: './dashboard-tickets.component.html',
})
export class DashboardTicketsComponent implements OnInit {
  items: Ticket[] = [];
  stats: TicketStats = {
    total: 0, nouveaux: 0, affectes: 0, enAnalyse: 0, enResolution: 0, enAttente: 0, resolus: 0, clotures: 0,
    ouverts: 0, p1p2: 0, attenteClient: 0, attenteTiers: 0, mesAssignes: 0, resolus7j: 0,
  };
  loading = true;
  error: string | null = null;
  isClient = this.auth.isClient();

  statuts = STATUTS_TICKET;
  categories = CATEGORIES;
  priorites = ['P1', 'P2', 'P3', 'P4'];

  // Filtres d'en-tête (combinables, côté client sur l'ensemble chargé)
  filterReference = '';
  filterObjet = '';
  filterClient = '';
  filterCategorie = '';
  filterSousCategorie = '';
  filterPriorite = '';
  filterStatut = '';
  filterDateFrom = '';

  constructor(private ticketService: TicketService, public auth: AuthService) {}

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  loadStats(): void {
    this.ticketService.getStats().subscribe({
      next: (s) => (this.stats = s),
      error: () => {},
    });
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.ticketService.getAll({ limit: '100' }).subscribe({
      next: (res) => {
        this.items = res.items;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors du chargement des tickets.';
        this.loading = false;
      },
    });
  }

  /** Sous-catégories proposées selon la catégorie filtrée (ou toutes). */
  sousCategoriesOptions(): string[] {
    if (this.filterCategorie) {
      return SOUS_CATEGORIES[this.filterCategorie] || [];
    }
    return Object.values(SOUS_CATEGORIES).flat();
  }

  filteredItems(): Ticket[] {
    const ref = this.filterReference.trim().toLowerCase();
    const objet = this.filterObjet.trim().toLowerCase();
    const client = this.filterClient.trim().toLowerCase();
    const from = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
    return this.items.filter((t) => {
      if (ref && !(t.reference?.toLowerCase().includes(ref) || false)) return false;
      if (objet && !(t.objet?.toLowerCase().includes(objet) || false)) return false;
      if (client && !this.clientNom(t).toLowerCase().includes(client)) return false;
      if (this.filterCategorie && t.categorie !== this.filterCategorie) return false;
      if (this.filterSousCategorie && t.sousCategorie !== this.filterSousCategorie) return false;
      if (this.filterPriorite && t.priorite !== this.filterPriorite) return false;
      if (this.filterStatut && t.statut !== this.filterStatut) return false;
      if (from && t.openedAt && new Date(t.openedAt) < from) return false;
      return true;
    });
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filterReference || this.filterObjet || this.filterClient ||
      this.filterCategorie || this.filterSousCategorie ||
      this.filterPriorite || this.filterStatut || this.filterDateFrom
    );
  }

  resetFilters(): void {
    this.filterReference = '';
    this.filterObjet = '';
    this.filterClient = '';
    this.filterCategorie = '';
    this.filterSousCategorie = '';
    this.filterPriorite = '';
    this.filterStatut = '';
    this.filterDateFrom = '';
  }

  /** Libellé du client (peuplé côté serveur). */
  clientNom(t: Ticket): string {
    const c = t.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  /** Email du client (peuplé côté serveur). */
  clientEmail(t: Ticket): string {
    const c = t.clientId as any;
    return c?.email || '';
  }

  /** URL de l'avatar du client (ou null → fallback initiales). */
  clientAvatar(t: Ticket): string {
    const c = t.clientId as any;
    return c?.avatarUrl ? resolveUploadUrl(c.avatarUrl) : '';
  }

  clientInitiales(t: Ticket): string {
    const nom = this.clientNom(t);
    return (nom || '?').trim().slice(0, 2).toUpperCase();
  }

  /** Pilule de priorité avec hiérarchie visuelle claire. */
  prioritePillClass(p: string | undefined): string {
    switch (p) {
      case 'P1': return 'bg-destructive/10 text-destructive ring-1 ring-destructive/30';
      case 'P2': return 'bg-warning/10 text-warning ring-1 ring-warning/30';
      case 'P3': return 'bg-primary/10 text-primary ring-1 ring-primary/20';
      default: return 'bg-muted text-muted-foreground ring-1 ring-border';
    }
  }
}

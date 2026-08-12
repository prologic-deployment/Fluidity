import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { Ticket, TicketStats, STATUTS_TICKET } from '../../models/ticket.model';
import { CATEGORIES } from '../../models/demande.model';

@Component({
  selector: 'app-dashboard-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-tickets.component.html',
})
export class DashboardTicketsComponent implements OnInit {
  items: Ticket[] = [];
  stats: TicketStats | null = null;
  loading = true;
  error: string | null = null;
  searchTerm = '';
  statutFiltre = '';
  prioriteFiltre = '';
  categorieFiltre = '';
  page = 1;
  pages = 1;
  total = 0;
  statuts = STATUTS_TICKET;
  categories = CATEGORIES;
  priorites = ['P1', 'P2', 'P3', 'P4'];

  constructor(private tickets: TicketService, public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.tickets.stats().subscribe({ next: (s) => (this.stats = s) });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.tickets
      .list({
        page: this.page,
        limit: 25,
        q: this.searchTerm,
        statut: this.statutFiltre,
        priorite: this.prioriteFiltre,
        categorie: this.categorieFiltre,
        sort: 'openedAt',
        dir: 'desc',
      })
      .subscribe({
        next: (res) => {
          this.items = res.items;
          this.total = res.total;
          this.pages = res.pages;
          this.page = res.page;
          this.loading = false;
        },
        error: () => {
          this.error = 'Impossible de charger les tickets.';
          this.loading = false;
        },
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.prioriteFiltre = '';
    this.categorieFiltre = '';
    this.applyFilters();
  }

  open(t: Ticket): void {
    this.router.navigate(['/tickets', t._id]);
  }

  clientNom(t: Ticket): string {
    const c = t.clientId;
    if (!c || typeof c === 'string') return '—';
    return c.nom || c.email || '—';
  }

  contratLabel(t: Ticket): string {
    const c = t.contrat;
    if (!c || typeof c === 'string') return '—';
    return c.reference || '—';
  }

  techLabel(t: Ticket): string {
    const a = t.assignedTo;
    if (!a || typeof a === 'string') return t.assignedTeam || 'Non affecté';
    return `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
  }

  prioriteClass(p?: string): string {
    if (p === 'P1') return 'badge-destructive';
    if (p === 'P2') return 'badge-warning';
    if (p === 'P3') return 'badge-default';
    return 'badge-outline';
  }

  statutClass(s?: string): string {
    if (s === 'Clôturé') return 'badge-secondary';
    if (s === 'Résolu') return 'badge-success';
    if (s === 'P1' || s === 'Nouveau') return 'badge-default';
    if (s?.includes('attente')) return 'badge-warning';
    return 'badge-outline';
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { Ticket, TicketStats, STATUTS_TICKET } from '../../models/ticket.model';

@Component({
  selector: 'app-dashboard-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-tickets.component.html',
})
export class DashboardTicketsComponent implements OnInit {
  items: Ticket[] = [];
  stats: TicketStats = { ouverts: 0, p1p2: 0, attenteClient: 0, attenteTiers: 0, mesAssignes: 0, resolus: 0 };
  loading = true;
  error: string | null = null;
  isClient = this.auth.isClient();

  statuts = STATUTS_TICKET;

  filterStatut = '';
  filterPriorite = '';

  constructor(private ticketService: TicketService, private auth: AuthService) {}

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
    const params: Record<string, string> = { limit: '100' };
    if (this.filterStatut) params['statut'] = this.filterStatut;
    if (this.filterPriorite) params['priorite'] = this.filterPriorite;
    this.ticketService.getAll(params).subscribe({
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

  applyFilters(): void {
    this.load();
  }

  /** Libellé du client (peuplé côté serveur). */
  clientNom(t: Ticket): string {
    const c = t.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  prioriteBadge(p: string | undefined): string {
    switch (p) {
      case 'P1': return 'badge-destructive';
      case 'P2': return 'badge-warning';
      case 'P3': return 'badge-outline';
      default: return 'badge-secondary';
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { Ticket, TicketComment } from '../../models/ticket.model';
import { availableTransitions, TICKET_TRANSITIONS } from '../../models/workflow';
import { resolveUploadUrl } from '../../utils/upload-url.util';

@Component({
  selector: 'app-ticket-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ticket-details.component.html',
})
export class TicketDetailsComponent implements OnInit {
  ticket: Ticket | null = null;
  comments: TicketComment[] = [];
  assignees: Array<{ _id: string; email: string; firstName?: string; lastName?: string; role: string }> = [];
  loading = true;
  error: string | null = null;
  role = this.auth.getRole();
  isClient = this.auth.isClient();

  // Workflow
  transitions: string[] = [];
  motif = '';
  resume = '';

  // Commentaire
  newComment = '';

  // Affectation
  selectedTeam = '';
  selectedAssignee = '';

  constructor(
    private ticketService: TicketService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.load(id);
    });
  }

  load(id: string): void {
    this.loading = true;
    this.error = null;
    this.ticketService.getById(id).subscribe({
      next: (t) => {
        this.ticket = t;
        this.transitions = t.transitionsAutorisees || [];
        this.loading = false;
        this.loadComments(id);
        if (!this.isClient) this.loadAssignees();
      },
      error: (err) => {
        this.error = err.error?.message || 'Ticket introuvable.';
        this.loading = false;
      },
    });
  }

  loadComments(id: string): void {
    this.ticketService.listerCommentaires(id).subscribe({
      next: (c) => (this.comments = c),
      error: () => {},
    });
  }

  loadAssignees(): void {
    this.ticketService.getAssignees().subscribe({
      next: (a) => (this.assignees = a),
      error: () => {},
    });
  }

  transition(statut: string): void {
    this.error = null;
    this.ticketService
      .changerStatut(this.ticket!._id!, {
        statut,
        motif: this.motif || undefined,
        resume: this.resume || undefined,
      })
      .subscribe({
        next: (t) => {
          this.ticket = t;
          this.transitions = t.transitionsAutorisees || [];
          this.motif = '';
          this.resume = '';
        },
        error: (err) => (this.error = err.error?.message || 'Transition refusée.'),
      });
  }

  assigner(): void {
    this.error = null;
    this.ticketService
      .assigner(this.ticket!._id!, {
        assignedTeam: this.selectedTeam || undefined,
        assignedTo: this.selectedAssignee || null,
      })
      .subscribe({
        next: (t) => (this.ticket = t),
        error: (err) => (this.error = err.error?.message || 'Affectation refusée.'),
      });
  }

  commenter(): void {
    if (!this.newComment.trim()) return;
    this.error = null;
    this.ticketService.commenter(this.ticket!._id!, this.newComment.trim()).subscribe({
      next: () => {
        this.newComment = '';
        this.loadComments(this.ticket!._id!);
        this.load(this.ticket!._id!);
      },
      error: (err) => (this.error = err.error?.message || 'Commentaire refusé.'),
    });
  }

  clientNom(): string {
    const c = this.ticket?.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  contratRef(): string {
    const c = this.ticket?.contrat as any;
    return c?.reference || (typeof c === 'string' ? c : '—');
  }

  assignedToLabel(): string {
    const a = this.ticket?.assignedTo as any;
    if (!a) return '—';
    if (typeof a === 'string') return a;
    return `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
  }

  resolveUrl(url?: string): string {
    return resolveUploadUrl(url);
  }

  prioriteClass(p?: string): string {
    switch (p) {
      case 'P1': return 'badge-destructive';
      case 'P2': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }
}

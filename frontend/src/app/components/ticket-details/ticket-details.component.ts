import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { Ticket, TicketComment, TicketActivity, EQUIPES_SUPPORT } from '../../models/ticket.model';
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
  activities: TicketActivity[] = [];
  assignees: Array<{ _id: string; email: string; firstName?: string; lastName?: string; role: string }> = [];
  loading = true;
  error: string | null = null;
  isClient = this.auth.isClient();

  readonly equipes = EQUIPES_SUPPORT;

  // Workflow
  transitions: string[] = [];
  transitionCible = '';
  transitionLoading = false;
  motif = '';
  resume = '';
  actionCorrective = '';
  workaround = '';

  // Commentaire
  commentText = '';
  commentInterne = false;
  commentLoading = false;

  // Affectation
  assignTeam = '';
  assignTo = '';
  assignLoading = false;

  copied = false;

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
        this.assignTeam = t.assignedTeam || '';
        this.assignTo = typeof t.assignedTo === 'object' && t.assignedTo ? t.assignedTo._id : '';
        this.loading = false;
        this.loadComments(id);
        this.loadActivities(id);
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

  loadActivities(id: string): void {
    this.ticketService.listerActivites(id).subscribe({
      next: (a) => (this.activities = a),
      error: () => {},
    });
  }

  loadAssignees(): void {
    this.ticketService.getAssignees().subscribe({
      next: (a) => (this.assignees = a),
      error: () => {},
    });
  }

  // --- Référence -------------------------------------------------------------

  copyRef(): void {
    if (!this.ticket?.reference) return;
    navigator.clipboard?.writeText(this.ticket.reference).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    });
  }

  // --- Workflow « Faire avancer » --------------------------------------------

  needsMotif(statut: string): boolean {
    return statut === 'En attente client' || statut === 'En attente tiers';
  }

  needsResolution(statut: string): boolean {
    return statut === 'Résolu';
  }

  appliquerTransition(): void {
    if (!this.ticket || !this.transitionCible) return;
    this.transitionLoading = true;
    this.error = null;
    this.ticketService
      .changerStatut(this.ticket._id!, {
        statut: this.transitionCible,
        motif: this.motif || undefined,
        resume: this.resume || undefined,
        actionCorrective: this.actionCorrective || undefined,
        workaround: this.workaround || undefined,
      })
      .subscribe({
        next: (t) => {
          this.ticket = t;
          this.transitions = t.transitionsAutorisees || [];
          this.transitionCible = '';
          this.motif = '';
          this.resume = '';
          this.actionCorrective = '';
          this.workaround = '';
          this.transitionLoading = false;
          this.loadActivities(t._id!);
        },
        error: (err) => {
          this.error = err.error?.message || 'Transition refusée.';
          this.transitionLoading = false;
        },
      });
  }

  // --- Affectation -----------------------------------------------------------

  assigner(): void {
    if (!this.ticket) return;
    this.assignLoading = true;
    this.error = null;
    this.ticketService
      .assigner(this.ticket._id!, {
        assignedTeam: this.assignTeam || undefined,
        assignedTo: this.assignTo || null,
      })
      .subscribe({
        next: (t) => {
          this.ticket = t;
          this.assignLoading = false;
          this.loadActivities(t._id!);
        },
        error: (err) => {
          this.error = err.error?.message || 'Affectation refusée.';
          this.assignLoading = false;
        },
      });
  }

  // --- Commentaires ----------------------------------------------------------

  sendComment(): void {
    if (!this.ticket || !this.commentText.trim()) return;
    this.commentLoading = true;
    this.error = null;
    this.ticketService
      .commenter(this.ticket._id!, this.commentText.trim(), this.commentInterne ? 'interne' : 'public')
      .subscribe({
        next: () => {
          this.commentText = '';
          this.commentLoading = false;
          this.loadComments(this.ticket!._id!);
          this.loadActivities(this.ticket!._id!);
        },
        error: (err) => {
          this.error = err.error?.message || 'Commentaire refusé.';
          this.commentLoading = false;
        },
      });
  }

  // --- Affichage -------------------------------------------------------------

  clientNom(): string {
    const c = this.ticket?.clientId as any;
    return c?.nom || (typeof c === 'string' ? c : '—');
  }

  contratLabel(): string {
    const c = this.ticket?.contrat as any;
    return c?.reference || (typeof c === 'string' ? c : '—');
  }

  assignedToLabel(): string {
    const a = this.ticket?.assignedTo as any;
    if (!a) return '—';
    if (typeof a === 'string') return a;
    return `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email;
  }

  auteurNom(c: TicketComment): string {
    const a = c.auteur as any;
    if (!a) return 'Utilisateur supprimé';
    if (typeof a === 'string') return 'Utilisateur';
    return `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Utilisateur';
  }

  auteurEmail(c: TicketComment): string {
    const a = c.auteur as any;
    if (!a) return '';
    return typeof a === 'string' ? a : a.email || '';
  }

  auteurInitiales(c: TicketComment): string {
    const a = c.auteur as any;
    const email = typeof a === 'string' ? a : a?.email || '';
    const first = (a?.firstName || email).trim().slice(0, 1);
    const second = a?.lastName ? a.lastName.trim().slice(0, 1) : email.trim().slice(1, 2);
    return `${first}${second}`.toUpperCase();
  }

  resolveUrl(url?: string): string {
    return resolveUploadUrl(url);
  }

  nomFichier(url: string): string {
    return url.split('/').pop() || url;
  }

  libelleAction(a: TicketActivity): string {
    const libelles: Record<string, string> = {
      creation: 'Création du ticket',
      affectation: 'Affectation',
      reaffectation: 'Réaffectation',
      qualification: 'Mise à jour de la qualification',
      statut: 'Changement de statut',
      resolution: 'Résolution',
      reouverture: 'Réouverture',
      cloture: 'Clôture',
      commentaire: 'Commentaire public',
      note_interne: 'Note interne',
    };
    return libelles[a.action] || a.action;
  }

  prioriteClass(p?: string): string {
    switch (p) {
      case 'P1': return 'badge-destructive';
      case 'P2': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  slaClass(): string {
    const code = this.ticket?.slaEtat?.code;
    if (code === 'breached') return 'text-destructive';
    if (code === 'at_risk') return 'text-warning';
    if (code === 'paused') return 'text-muted-foreground';
    return 'text-success';
  }
}

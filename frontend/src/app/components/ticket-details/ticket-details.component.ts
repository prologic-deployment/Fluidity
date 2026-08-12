import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import {
  EQUIPES_SUPPORT,
  Ticket,
  TicketActivity,
  TicketComment,
} from '../../models/ticket.model';

@Component({
  selector: 'app-ticket-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './ticket-details.component.html',
})
export class TicketDetailsComponent implements OnInit {
  ticket: Ticket | null = null;
  comments: TicketComment[] = [];
  activities: TicketActivity[] = [];
  assignees: { _id: string; email: string; firstName?: string; lastName?: string }[] = [];
  loading = true;
  error: string | null = null;
  copied = false;

  commentText = '';
  commentInterne = false;
  commentLoading = false;

  assignTeam = '';
  assignTo = '';
  assignLoading = false;

  transitionCible = '';
  motif = '';
  resume = '';
  actionCorrective = '';
  workaround = '';
  transitionLoading = false;
  equipes = EQUIPES_SUPPORT;

  constructor(private route: ActivatedRoute, private tickets: TicketService, public auth: AuthService, private i18n: I18nService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.reload(id);
    if (!this.auth.isClient()) {
      this.tickets.assignees().subscribe({ next: (u) => (this.assignees = u) });
    }
  }

  reload(id?: string): void {
    const tid = id || this.ticket?._id;
    if (!tid) return;
    this.loading = !this.ticket;
    this.tickets.getById(tid).subscribe({
      next: (t) => {
        this.ticket = t;
        this.assignTeam = t.assignedTeam || '';
        this.assignTo = typeof t.assignedTo === 'object' && t.assignedTo ? t.assignedTo._id : '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Ticket introuvable.';
        this.loading = false;
      },
    });
    this.tickets.commentaires(tid).subscribe({ next: (c) => (this.comments = c) });
    this.tickets.activites(tid).subscribe({ next: (a) => (this.activities = a) });
  }

  get transitions(): string[] {
    return this.ticket?.transitionsAutorisees || [];
  }

  copyRef(): void {
    if (!this.ticket?.reference) return;
    navigator.clipboard.writeText(this.ticket.reference).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    });
  }

  clientNom(): string {
    const c = this.ticket?.clientId;
    if (!c || typeof c === 'string') return '—';
    return c.nom || c.email || '—';
  }

  contratLabel(): string {
    const c = this.ticket?.contrat;
    if (!c || typeof c === 'string') return '—';
    return `${c.reference} — ${c.intitule || ''}`;
  }

  prioriteClass(p?: string): string {
    if (p === 'P1') return 'badge-destructive';
    if (p === 'P2') return 'badge-warning';
    if (p === 'P3') return 'badge-default';
    return 'badge-outline';
  }

  slaClass(): string {
    const c = this.ticket?.slaEtat?.code;
    if (c === 'breached') return 'text-destructive';
    if (c === 'at_risk' || c === 'paused') return 'text-warning';
    return 'text-success';
  }

  sendComment(): void {
    if (!this.ticket?._id || !this.commentText.trim()) return;
    this.commentLoading = true;
    this.tickets
      .commenter(this.ticket._id, {
        corps: this.commentText.trim(),
        visibilite: this.commentInterne && !this.auth.isClient() ? 'interne' : 'public',
      })
      .subscribe({
        next: () => {
          this.commentText = '';
          this.commentLoading = false;
          this.reload();
        },
        error: (err) => {
          this.error = err.error?.message || 'Commentaire refusé.';
          this.commentLoading = false;
        },
      });
  }

  assigner(): void {
    if (!this.ticket?._id) return;
    this.assignLoading = true;
    this.tickets.assigner(this.ticket._id, { assignedTeam: this.assignTeam, assignedTo: this.assignTo || null }).subscribe({
      next: () => {
        this.assignLoading = false;
        this.reload();
      },
      error: (err) => {
        this.error = err.error?.message || 'Affectation refusée.';
        this.assignLoading = false;
      },
    });
  }

  needsMotif(statut: string): boolean {
    return statut === 'En attente client' || statut === 'En attente tiers';
  }

  needsResolution(statut: string): boolean {
    return statut === 'Résolu';
  }

  appliquerTransition(): void {
    if (!this.ticket?._id || !this.transitionCible) return;
    if (this.needsMotif(this.transitionCible) && !this.motif.trim()) {
      this.error = 'Motif d’attente requis.';
      return;
    }
    if (this.needsResolution(this.transitionCible) && !this.resume.trim()) {
      this.error = 'Résumé de résolution requis.';
      return;
    }
    this.transitionLoading = true;
    this.tickets
      .changerStatut(this.ticket._id, {
        statut: this.transitionCible,
        motif: this.motif || undefined,
        resume: this.resume || undefined,
        actionCorrective: this.actionCorrective || undefined,
        workaround: this.workaround || undefined,
      })
      .subscribe({
        next: () => {
          this.transitionCible = '';
          this.motif = '';
          this.resume = '';
          this.transitionLoading = false;
          this.reload();
        },
        error: (err) => {
          this.error = err.error?.message || 'Transition refusée.';
          this.transitionLoading = false;
        },
      });
  }

  libelleAction(a: TicketActivity): string {
    const map: Record<string, string> = {
      creation: 'Création',
      statut: 'Changement de statut',
      affectation: 'Affectation',
      reaffectation: 'Réaffectation',
      qualification: 'Qualification',
      commentaire: 'Commentaire public',
      note_interne: 'Note interne',
      resolution: 'Résolution',
      reouverture: 'Réouverture',
      cloture: 'Clôture',
    };
    const key = 'workflow.' + a.action;
    const tr = this.i18n.t(key);
    return tr === key ? (map[a.action] || a.action) : tr;
  }

  nomFichier(url: string): string {
    return url.split('/').pop() || url;
  }
}

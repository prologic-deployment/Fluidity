import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement } from '../../models/changement.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { CHANGEMENT_TRANSITIONS, availableTransitions } from '../../models/workflow';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  loading = false;
  error: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  typeFiltre = '';

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

  filteredChangements(): Changement[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.changements.filter((c) => {
      const matchTerm =
        !term ||
        c.objetChangement.toLowerCase().includes(term) ||
        this.clientNom(c).toLowerCase().includes(term) ||
        c.categorie.toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || c.statut === this.statutFiltre;
      const matchType = !this.typeFiltre || c.typeChangement === this.typeFiltre;
      return matchTerm && matchStatut && matchType;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.typeFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.typeFiltre = '';
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

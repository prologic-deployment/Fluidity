import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DEMANDE_TRANSITIONS, availableTransitions } from '../../models/workflow';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  prioriteFiltre = '';

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

  /** Email du demandeur (peuplé côté serveur). */
  requesterEmail(d: Demande): string {
    const r = d.requester as any;
    return r?.email || (typeof r === 'string' ? r : '');
  }

  /** Liste filtrée (recherche texte + statut + priorité), la plus récente en premier. */
  filteredDemandes(): Demande[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.demandes.filter((d) => {
      const matchTerm =
        !term ||
        d.objet.toLowerCase().includes(term) ||
        this.clientNom(d).toLowerCase().includes(term) ||
        d.categorie.toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || d.statut === this.statutFiltre;
      const matchPriorite = !this.prioriteFiltre || d.prioriteSouhaitee === this.prioriteFiltre;
      return matchTerm && matchStatut && matchPriorite;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.prioriteFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.prioriteFiltre = '';
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

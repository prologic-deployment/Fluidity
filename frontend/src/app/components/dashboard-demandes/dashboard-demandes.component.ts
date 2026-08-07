import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { Demande } from '../../models/demande.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { WorkflowStepperComponent } from '../shared/workflow-stepper.component';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DEMANDE_TRANSITIONS, availableTransitions } from '../../models/workflow';
import { requesterEmail, requesterClientNom, requesterStatut, nomFichierDepuisUrl } from '../../utils/requester.util';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, WorkflowStepperComponent, UrlUploadPipe],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;
  selected: Demande | null = null;
  transitionLoading = false;
  transitionError: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  prioriteFiltre = '';
  /** Filtre « Client » (raison sociale du demandeur — colonne dédiée). */
  clientFiltre = '';
  /** Clients distincts présents dans la liste — reconstruit au chargement
   *  (jamais dans un getter : identité de tableau stable pour le template). */
  clientsFiltres: string[] = [];

  // --- Tri des colonnes (clic sur l'en-tête : bascule asc/desc) --------------
  triColonne: 'objet' | 'client' | 'categorie' | 'priorite' | 'statut' | 'date' = 'date';
  triDirection: 1 | -1 = -1; // date la plus récente d'abord par défaut

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

  /** Statuts depuis lesquels le client propriétaire peut annuler sa demande. */
  readonly statutsAnnulables = ['Ouverte', "En cours d'analyse", 'En attente de validation', 'En attente client'];

  // --- Synthèse & frise de progression (§ UI) --------------------------------
  /** Piste nominale du workflow demandes (la pause « En attente client » est
   *  rattachée visuellement à « En cours de réalisation »). */
  readonly pisteWorkflow = [
    'Ouverte',
    "En cours d'analyse",
    'En attente de validation',
    'En cours de réalisation',
    'Réalisée',
    'Clôturée',
  ];
  /** Statuts « en vie » côté traitement (pour la carte En cours). */
  private readonly statutsEnCours = [
    'Ouverte',
    "En cours d'analyse",
    'En attente de validation',
    'En cours de réalisation',
    'En attente client',
  ];
  /** Statuts hors piste (sorties de parcours). */
  private readonly statutsHorsPiste = ['Rejetée', 'Annulé'];

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
        this.clientsFiltres = [...new Set(data.map((d) => this.clientNom(d)).filter((n) => n && n !== '—'))].sort(
          (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des demandes.';
        this.loading = false;
      },
    });
  }

  /** Liste filtrée (recherche texte + statut + priorité + client) puis triée
   *  selon la colonne active (par défaut : date de création décroissante). */
  filteredDemandes(): Demande[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.demandes
      .filter((d) => {
        const matchTerm =
          !term ||
          d.objet.toLowerCase().includes(term) ||
          this.requesterEmail(d).toLowerCase().includes(term) ||
          this.clientNom(d).toLowerCase().includes(term) ||
          d.categorie.toLowerCase().includes(term);
        const matchStatut = !this.statutFiltre || d.statut === this.statutFiltre;
        const matchPriorite = !this.prioriteFiltre || d.prioriteSouhaitee === this.prioriteFiltre;
        const matchClient = !this.clientFiltre || this.clientNom(d) === this.clientFiltre;
        return matchTerm && matchStatut && matchPriorite && matchClient;
      })
      .sort((a, b) => this.comparer(a, b));
  }

  /** Clic sur un en-tête triable : nouvelle colonne -> sens naturel, sinon bascule. */
  trierPar(colonne: typeof this.triColonne): void {
    if (this.triColonne === colonne) {
      this.triDirection = this.triDirection === 1 ? -1 : 1;
      return;
    }
    this.triColonne = colonne;
    this.triDirection = colonne === 'date' ? -1 : 1;
  }

  /** Comparateur multi-critères (insensible aux accents pour le texte). */
  private comparer(a: Demande, b: Demande): number {
    let v = 0;
    switch (this.triColonne) {
      case 'objet':
        v = (a.objet || '').localeCompare(b.objet || '', 'fr', { sensitivity: 'base' });
        break;
      case 'client':
        v = this.clientNom(a).localeCompare(this.clientNom(b), 'fr', { sensitivity: 'base' });
        break;
      case 'categorie':
        v = (a.categorie || '').localeCompare(b.categorie || '', 'fr', { sensitivity: 'base' });
        break;
      case 'priorite':
        v = (DashboardDemandesComponent.RANG_PRIORITE[a.prioriteSouhaitee] || 0)
          - (DashboardDemandesComponent.RANG_PRIORITE[b.prioriteSouhaitee] || 0);
        break;
      case 'statut':
        v = (a.statut || '').localeCompare(b.statut || '', 'fr', { sensitivity: 'base' });
        break;
      case 'date':
        v = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        break;
    }
    return v * this.triDirection;
  }

  /** Ordre métier des priorités pour le tri (Standard < Élevée < Urgente). */
  private static readonly RANG_PRIORITE: Record<string, number> = { Standard: 1, Élevée: 2, Urgente: 3 };

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.prioriteFiltre || this.clientFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.prioriteFiltre = '';
    this.clientFiltre = '';
  }

  // --- Cartes de synthèse -----------------------------------------------------

  get totalCount(): number {
    return this.demandes.length;
  }

  /** Dossiers en vie dans le traitement (hors terminaux/hors piste). */
  get enCoursCount(): number {
    return this.demandes.filter((d) => this.statutsEnCours.includes(d.statut || '')).length;
  }

  /** La balle est côté client : réponse/validation attendue. */
  get actionRequiseCount(): number {
    return this.demandes.filter((d) => d.statut === 'En attente client' || d.statut === 'En attente de validation').length;
  }

  /** Réalisées + clôturées (sorties positives). */
  get terminesCount(): number {
    return this.demandes.filter((d) => d.statut === 'Réalisée' || d.statut === 'Clôturée').length;
  }

  /** Répartition par statut (panneau latéral) — barres proportionnelles au max. */
  get distribution(): { label: string; count: number; pct: number }[] {
    const compteurs = new Map<string, number>();
    for (const d of this.demandes) {
      if (!d.statut) continue;
      compteurs.set(d.statut, (compteurs.get(d.statut) || 0) + 1);
    }
    const max = Math.max(1, ...compteurs.values());
    return this.statutsFiltrables
      .filter((s) => compteurs.has(s))
      .map((s) => ({ label: s, count: compteurs.get(s) || 0, pct: Math.round(((compteurs.get(s) || 0) / max) * 100) }));
  }

  /** Étape de la frise correspondant au statut (null pour les sorties de parcours). */
  etapeCourante(statut?: string): string | null {
    if (!statut) return null;
    if (statut === 'En attente client') return 'En cours de réalisation'; // pause sur la piste
    return this.pisteWorkflow.includes(statut) ? statut : null;
  }

  /** Statut terminal hors piste, pour l'affichage « parcours interrompu ». */
  statutHorsPiste(statut?: string): string | null {
    return statut && this.statutsHorsPiste.includes(statut) ? statut : null;
  }

  viewDetails(demande: Demande): void {
    this.selected = demande;
    this.transitionError = null;
  }

  closeDetails(): void {
    this.selected = null;
    this.transitionError = null;
  }

  /** Email du compte demandeur (référence ObjectId peuplée côté serveur). */
  requesterEmail(demande: Demande): string {
    return requesterEmail(demande.requester);
  }

  /**
   * Raison sociale du client du dossier (colonne « Client ») : fiche société
   * rattachée peuplée côté serveur, sinon identité du compte demandeur.
   */
  clientNom(demande: Demande): string {
    return requesterClientNom(demande.requester);
  }

  /** Statut de la fiche cliente du demandeur (badge « Fiche » de la modale). */
  statutClient(demande: Demande): string | null {
    return requesterStatut(demande.requester);
  }

  /** Nom lisible d'une pièce jointe (URL -> nom de fichier décodé). */
  nomPieceJointe(url: string): string {
    return nomFichierDepuisUrl(url);
  }

  /** Référence lisible du contrat rattaché (ObjectId peuplé en lecture). */
  contratLabel(demande: Demande): string {
    const c = demande.contrat;
    if (c && typeof c === 'object') return c.reference;
    return (c as string) || '—';
  }

  /** Le client connecté est le propriétaire de la demande. */
  isOwner(demande: Demande): boolean {
    if (!this.auth.isClient()) return false;
    const r = demande.requester;
    if (r && typeof r === 'object') {
      return r._id === this.auth.getUserId() || r.email === this.auth.getEmail();
    }
    return r === this.auth.getUserId();
  }

  /**
   * Annulation possible uniquement : client propriétaire + statut précoce.
   * (Un dossier « Annulé » est figé : aucune action n'est plus proposée.)
   */
  isAnnulable(demande: Demande): boolean {
    return this.isOwner(demande) && !!demande.statut && this.statutsAnnulables.includes(demande.statut);
  }

  /**
   * « Annuler » remplace la suppression pour un client : le dossier reste en
   * base, visible dans l'historique, et passe au statut « Annulé » (état final).
   */
  async annulerDemande(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message:
        'La demande sera conservée dans l\'historique avec le statut « Annulé ». Cette action est définitive : aucune reprise ne sera possible.',
      confirmLabel: 'Annuler la demande',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.annuler(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de l\'annulation.'),
    });
  }

  async cancelDemande(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message: 'La demande restera visible dans l\'historique mais ne pourra plus être traitée.',
      confirmLabel: 'Annuler la demande',
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.cancel(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de l\'annulation.'),
    });
  }

  /** Statuts vers lesquels le rôle courant peut faire transiter la demande sélectionnée
   * (l'annulation "Annulé" est gérée séparément via le bouton dédié — voir canCancel/cancelDemande). */
  prochainesEtapes(): string[] {
    if (!this.selected) return [];
    return availableTransitions(DEMANDE_TRANSITIONS, this.selected.statut, this.auth.getRole()).filter((s) => s !== 'Annulé');
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.selected?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.demandeService.changerStatut(this.selected._id, nouveauStatut).subscribe({
      next: (updated) => {
        this.selected = updated;
        this.transitionLoading = false;
        this.load();
      },
      error: (err) => {
        this.transitionError = err.error?.message || 'Transition refusée.';
        this.transitionLoading = false;
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Retourne la classe de badge (shadcn) selon le statut. */
  statutClass(statut?: string): string {
    switch (statut) {
      case 'Ouverte':
        return 'badge-outline';
      case 'En cours d\'analyse':
        return 'badge-secondary';
      case 'En attente de validation':
        return 'badge-secondary';
      case 'En cours de réalisation':
        return 'badge-warning';
      case 'En attente client':
        return 'badge-warning';
      case 'Réalisée':
        return 'badge-success';
      case 'Clôturée':
        return 'badge-secondary';
      case 'Rejetée':
        return 'badge-destructive';
      case 'Annulé':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }

  prioriteClass(priorite?: string): string {
    switch (priorite) {
      case 'Urgente':
        return 'badge-destructive';
      case 'Élevée':
        return 'badge-warning';
      default:
        return 'badge-outline';
    }
  }
}

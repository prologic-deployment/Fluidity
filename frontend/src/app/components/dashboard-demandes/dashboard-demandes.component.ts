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
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-dashboard-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, WorkflowStepperComponent, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './dashboard-demandes.component.html',
})
export class DashboardDemandesComponent implements OnInit {
  demandes: Demande[] = [];
  loading = false;
  error: string | null = null;
  selected: Demande | null = null;
  transitionLoading = false;
  transitionError: string | null = null;

  // --- Pagination serveur (PERF-002) ------------------------------------------
  page = 1;
  pages = 1;
  total = 0;
  readonly limitePage = 50;
  /** Synthèse par statut sur la portée complète (fournie par l'API). */
  parStatut: Record<string, number> = {};
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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
  ,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.demandeService
      .getAll({
        page: this.page,
        limit: this.limitePage,
        statut: this.statutFiltre || undefined,
        priorite: this.prioriteFiltre || undefined,
        recherche: this.searchTerm.trim() || undefined,
        client: this.clientFiltre || undefined,
        tri: this.triColonne === 'client' ? 'date' : this.triColonne,
        dir: this.triDirection === 1 ? 'asc' : 'desc',
      })
      .subscribe({
        next: (data) => {
          this.demandes = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
          this.parStatut = data.stats?.parStatut || {};
          // Sélecteur « Client » : noms présents sur la page (+ sélection courante).
          const noms = new Set(this.demandes.map((d) => this.clientNom(d)).filter((n) => n && n !== '—'));
          if (this.clientFiltre) noms.add(this.clientFiltre);
          this.clientsFiltres = [...noms].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
          this.loading = false;
        },
        error: (err) => {
          this.error = apiErrorMessage(this.i18n, err, 'demandes.loadError');
          this.loading = false;
        },
      });
  }

  /** Recherche avec anti-rebond (300 ms) — filtrage côté serveur. */
  onSearchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  /** Changement de filtre/tri : retour page 1 + rechargement serveur. */
  onFiltersChanged(): void {
    this.page = 1;
    this.load();
  }

  allerPage(p: number): void {
    if (p >= 1 && p <= this.pages && p !== this.page) {
      this.page = p;
      this.load();
    }
  }

  /** Liste courante : filtrage + tri + pagination appliqués CÔTÉ SERVEUR (PERF-002). */
  filteredDemandes(): Demande[] {
    return this.demandes;
  }

  /** Clic sur un en-tête triable : nouvelle colonne -> sens naturel, sinon bascule. */
  trierPar(colonne: typeof this.triColonne): void {
    if (this.triColonne === colonne) {
      this.triDirection = this.triDirection === 1 ? -1 : 1;
    } else {
      this.triColonne = colonne;
      this.triDirection = colonne === 'date' ? -1 : 1;
    }
    this.onFiltersChanged();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.prioriteFiltre || this.clientFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.prioriteFiltre = '';
    this.clientFiltre = '';
    this.onFiltersChanged();
  }

  // --- Cartes de synthèse (basées sur la synthèse serveur, portée complète) ---

  get totalCount(): number {
    return this.total;
  }

  private sommeStatuts(statuts: string[]): number {
    return statuts.reduce((acc, s) => acc + (this.parStatut[s] || 0), 0);
  }

  /** Dossiers en vie dans le traitement (hors terminaux/hors piste). */
  get enCoursCount(): number {
    return this.sommeStatuts(this.statutsEnCours);
  }

  /** La balle est côté client : réponse/validation attendue. */
  get actionRequiseCount(): number {
    return this.sommeStatuts(['En attente client', 'En attente de validation']);
  }

  /** Réalisées + clôturées (sorties positives). */
  get terminesCount(): number {
    return this.sommeStatuts(['Réalisée', 'Clôturée']);
  }

  /** Répartition par statut (panneau latéral) — barres proportionnelles au max. */
  get distribution(): { label: string; count: number; pct: number }[] {
    const lignes: [string, number][] = this.statutsFiltrables
      .map((s) => [s, this.parStatut[s] || 0] as [string, number])
      .filter(([, n]) => n > 0);
    const compteurs = new Map<string, number>(lignes);
    const max = Math.max(1, ...compteurs.values());
    return [...compteurs.entries()].map(([label, count]) => ({ label, count, pct: Math.round((count / max) * 100) }));
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
      confirmLabel: this.i18n.t('demandes.cancel'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.annuler(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'demandes.cancelError')),
    });
  }

  async cancelDemande(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler cette demande ?',
      message: this.i18n.t('demandes.cancelMessage'),
      confirmLabel: this.i18n.t('demandes.cancel'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.demandeService.cancel(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'demandes.cancelError')),
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
        this.transitionError = apiErrorMessage(this.i18n, err, 'demandes.transitionError');
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

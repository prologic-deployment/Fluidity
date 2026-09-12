import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { Changement, StockageEntry, normalizeStockage, displayStockageType, displayStockageProtocole } from '../../models/changement.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { WorkflowStepperComponent } from '../shared/workflow-stepper.component';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { CHANGEMENT_TRANSITIONS, availableTransitions } from '../../models/workflow';
import { requesterEmail, requesterClientNom, requesterStatut, nomFichierDepuisUrl } from '../../utils/requester.util';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-dashboard-changements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, WorkflowStepperComponent, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './dashboard-changements.component.html',
})
export class DashboardChangementsComponent implements OnInit {
  changements: Changement[] = [];
  loading = false;
  error: string | null = null;
  active = 'changements';
  selected: Changement | null = null;
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
  typeFiltre = '';
  /** Filtre « Client » (raison sociale du demandeur — colonne dédiée). */
  clientFiltre = '';
  /** Clients distincts présents dans la liste — reconstruit au chargement
   *  (jamais dans un getter : identité de tableau stable pour le template). */
  clientsFiltres: string[] = [];

  // --- Tri des colonnes (clic sur l'en-tête : bascule asc/desc) --------------
  triColonne: 'objet' | 'client' | 'type' | 'categorie' | 'statut' | 'date' = 'date';
  triDirection: 1 | -1 = -1; // date la plus récente d'abord par défaut

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

  /** Statuts depuis lesquels le client propriétaire peut annuler son changement. */
  readonly statutsAnnulables = ['Soumis', 'En attente de validation', 'Approuvé', 'Planifié'];

  // --- Synthèse & frise de progression (§ UI) --------------------------------
  /** Piste nominale du workflow changements (§2.3.4). */
  readonly pisteWorkflow = [
    'Soumis',
    'En attente de validation',
    'Approuvé',
    'Planifié',
    "En cours d'implémentation",
    'Implémenté',
    'En revue post-implémentation',
    'Clôturé',
  ];
  /** Statuts « en vie » du traitement (carte En cours). */
  private readonly statutsEnCours = [
    'Soumis',
    'En attente de validation',
    'Approuvé',
    'Planifié',
    "En cours d'implémentation",
  ];
  /** Statuts hors piste (sorties de parcours). */
  private readonly statutsHorsPiste = ['Rollback', 'Rejeté', 'Annulé'];

  constructor(
    private changementService: ChangementService,
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
    this.changementService
      .getAll({
        page: this.page,
        limit: this.limitePage,
        statut: this.statutFiltre || undefined,
        type: this.typeFiltre || undefined,
        recherche: this.searchTerm.trim() || undefined,
        client: this.clientFiltre || undefined,
        tri: this.triColonne === 'client' ? 'date' : this.triColonne,
        dir: this.triDirection === 1 ? 'asc' : 'desc',
      })
      .subscribe({
        next: (data) => {
          this.changements = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
          this.parStatut = data.stats?.parStatut || {};
          const noms = new Set(this.changements.map((c) => this.clientNom(c)).filter((n) => n && n !== '—'));
          if (this.clientFiltre) noms.add(this.clientFiltre);
          this.clientsFiltres = [...noms].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
          this.loading = false;
        },
        error: (err) => {
          this.error = apiErrorMessage(this.i18n, err, 'changements.loadError');
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
  filteredChangements(): Changement[] {
    return this.changements;
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
    return !!(this.searchTerm || this.statutFiltre || this.typeFiltre || this.clientFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.typeFiltre = '';
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

  /** Changements en vie dans le traitement (jusqu'à l'implémentation). */
  get enCoursCount(): number {
    return this.sommeStatuts(this.statutsEnCours);
  }

  /** À valider : Soumis ou en attente de validation (goulot d'étranglement). */
  get aValiderCount(): number {
    return this.sommeStatuts(['Soumis', 'En attente de validation']);
  }

  /** Implémentés, en revue post-implémentation ou clôturés (sorties positives). */
  get terminesCount(): number {
    return this.sommeStatuts(['Implémenté', 'En revue post-implémentation', 'Clôturé']);
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
    return statut && this.pisteWorkflow.includes(statut) ? statut : null;
  }

  /** Statut terminal hors piste, pour l'affichage « parcours interrompu ». */
  statutHorsPiste(statut?: string): string | null {
    return statut && this.statutsHorsPiste.includes(statut) ? statut : null;
  }

  viewDetails(changement: Changement): void {
    this.selected = changement;
    this.transitionError = null;
  }

  closeDetails(): void {
    this.selected = null;
    this.transitionError = null;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Email du compte demandeur (référence ObjectId peuplée côté serveur). */
  requesterEmail(changement: Changement): string {
    return requesterEmail(changement.requester);
  }

  /**
   * Raison sociale du client du dossier (colonne « Client ») : fiche société
   * rattachée peuplée côté serveur, sinon identité du compte demandeur.
   */
  clientNom(changement: Changement): string {
    return requesterClientNom(changement.requester);
  }

  /** Statut de la fiche cliente du demandeur (badge « Fiche » de la modale). */
  statutClient(changement: Changement): string | null {
    return requesterStatut(changement.requester);
  }

  /** Nom lisible d'une pièce jointe (URL -> nom de fichier décodé). */
  nomPieceJointe(url: string): string {
    return nomFichierDepuisUrl(url);
  }

  /** Référence lisible du contrat rattaché (ObjectId peuplé en lecture). */
  contratLabel(changement: Changement): string {
    const ct = changement.contrat;
    if (ct && typeof ct === 'object') return ct.reference;
    return (ct as string) || '—';
  }

  // --- Stockage multi-entrées (compatibilité legacy) -------------------------

  /** Retourne les configurations de stockage normalisées en tableau (legacy object → [object]). */
  getStockages(changement: Changement): StockageEntry[] {
    const stockage = (changement.specifications as any)?.stockage ?? (changement.specifications as any)?.storageSpecifications;
    return normalizeStockage(stockage);
  }

  /** Affiche le type de stockage (gère "Autre" → précision). */
  displayStockageType(entry: any): string {
    return displayStockageType(entry);
  }

  /** Affiche le protocole (gère "Autre" → précision). */
  displayStockageProtocole(entry: any): string {
    return displayStockageProtocole(entry);
  }

  isStockageArray(stockage: any): boolean {
    return Array.isArray(stockage);
  }

  asStockageArray(stockage: any): StockageEntry[] {
    return normalizeStockage(stockage);
  }

  /** Le client connecté est le propriétaire du changement. */
  isOwner(changement: Changement): boolean {
    if (!this.auth.isClient()) return false;
    const r = changement.requester;
    if (r && typeof r === 'object') {
      return r._id === this.auth.getUserId() || r.email === this.auth.getEmail();
    }
    return r === this.auth.getUserId();
  }

  /**
   * Annulation possible uniquement : client propriétaire + statut précoce.
   * (Un dossier « Annulé » est figé : aucune action n'est plus proposée.)
   */
  isAnnulable(changement: Changement): boolean {
    return this.isOwner(changement) && !!changement.statut && this.statutsAnnulables.includes(changement.statut);
  }

  /**
   * « Annuler » remplace la suppression pour un client : le dossier reste en
   * base, visible dans l'historique, et passe au statut « Annulé » (état final).
   */
  async annulerChangement(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message:
        'Le changement sera conservé dans l\'historique avec le statut « Annulé ». Cette action est définitive : aucune reprise ne sera possible.',
      confirmLabel: this.i18n.t('changements.cancel'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.annuler(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'changements.cancelError')),
    });
  }

  async cancelChangement(id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Annuler ce changement ?',
      message: this.i18n.t('changements.cancelMessage'),
      confirmLabel: this.i18n.t('changements.cancel'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.changementService.cancel(id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'changements.cancelError')),
    });
  }

  /** Statuts vers lesquels le rôle courant peut faire transiter le changement sélectionné
   * (l'annulation "Annulé" est gérée séparément via le bouton dédié — voir canCancel/cancelChangement). */
  prochainesEtapes(): string[] {
    if (!this.selected) return [];
    return availableTransitions(CHANGEMENT_TRANSITIONS, this.selected.statut, this.auth.getRole()).filter((s) => s !== 'Annulé');
  }

  changerStatut(nouveauStatut: string): void {
    if (!this.selected?._id) return;
    this.transitionLoading = true;
    this.transitionError = null;
    this.changementService.changerStatut(this.selected._id, nouveauStatut).subscribe({
      next: (updated) => {
        this.selected = updated;
        this.transitionLoading = false;
        this.load();
      },
      error: (err) => {
        this.transitionError = apiErrorMessage(this.i18n, err, 'changements.transitionError');
        this.transitionLoading = false;
      },
    });
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'Soumis':
        return 'badge-outline';
      case 'En attente de validation':
        return 'badge-secondary';
      case 'Approuvé':
        return 'badge-secondary';
      case 'Planifié':
        return 'badge-secondary';
      case "En cours d'implémentation":
        return 'badge-warning';
      case 'Rollback':
        return 'badge-destructive';
      case 'Implémenté':
        return 'badge-success';
      case 'En revue post-implémentation':
        return 'badge-warning';
      case 'Clôturé':
        return 'badge-secondary';
      case 'Rejeté':
        return 'badge-destructive';
      case 'Annulé':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }

  typeClass(type?: string): string {
    switch (type) {
      case 'Urgent':
        return 'badge-destructive';
      case 'Majeur':
        return 'badge-warning';
      default:
        return 'badge-outline';
    }
  }
}

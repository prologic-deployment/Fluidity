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
    this.changementService.getAll().subscribe({
      next: (data) => {
        this.changements = data;
        this.clientsFiltres = [...new Set(data.map((c) => this.clientNom(c)).filter((n) => n && n !== '—'))].sort(
          (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        this.loading = false;
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'changements.loadError');
        this.loading = false;
      },
    });
  }

  /** Liste filtrée (recherche texte + statut + type + client) puis triée
   *  selon la colonne active (par défaut : date de création décroissante). */
  filteredChangements(): Changement[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.changements
      .filter((c) => {
        const matchTerm =
          !term ||
          c.objetChangement.toLowerCase().includes(term) ||
          this.requesterEmail(c).toLowerCase().includes(term) ||
          this.clientNom(c).toLowerCase().includes(term) ||
          c.categorie.toLowerCase().includes(term);
        const matchStatut = !this.statutFiltre || c.statut === this.statutFiltre;
        const matchType = !this.typeFiltre || c.typeChangement === this.typeFiltre;
        const matchClient = !this.clientFiltre || this.clientNom(c) === this.clientFiltre;
        return matchTerm && matchStatut && matchType && matchClient;
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
  private comparer(a: Changement, b: Changement): number {
    let v = 0;
    switch (this.triColonne) {
      case 'objet':
        v = (a.objetChangement || '').localeCompare(b.objetChangement || '', 'fr', { sensitivity: 'base' });
        break;
      case 'client':
        v = this.clientNom(a).localeCompare(this.clientNom(b), 'fr', { sensitivity: 'base' });
        break;
      case 'type':
        v = (DashboardChangementsComponent.RANG_TYPE[a.typeChangement] || 0)
          - (DashboardChangementsComponent.RANG_TYPE[b.typeChangement] || 0);
        break;
      case 'categorie':
        v = (a.categorie || '').localeCompare(b.categorie || '', 'fr', { sensitivity: 'base' });
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

  /** Ordre métier des types pour le tri (Standard < Majeur < Urgent). */
  private static readonly RANG_TYPE: Record<string, number> = { Standard: 1, Majeur: 2, Urgent: 3 };

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre || this.typeFiltre || this.clientFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
    this.typeFiltre = '';
  }

  // --- Cartes de synthèse -----------------------------------------------------

  get totalCount(): number {
    return this.changements.length;
  }

  /** Changements en vie dans le traitement (jusqu'à l'implémentation). */
  get enCoursCount(): number {
    return this.changements.filter((c) => this.statutsEnCours.includes(c.statut || '')).length;
  }

  /** À valider : Soumis ou en attente de validation (goulot d'étranglement). */
  get aValiderCount(): number {
    return this.changements.filter((c) => c.statut === 'Soumis' || c.statut === 'En attente de validation').length;
  }

  /** Implémentés, en revue post-implémentation ou clôturés (sorties positives). */
  get terminesCount(): number {
    return this.changements.filter(
      (c) => c.statut === 'Implémenté' || c.statut === 'En revue post-implémentation' || c.statut === 'Clôturé'
    ).length;
  }

  /** Répartition par statut (panneau latéral) — barres proportionnelles au max. */
  get distribution(): { label: string; count: number; pct: number }[] {
    const compteurs = new Map<string, number>();
    for (const c of this.changements) {
      if (!c.statut) continue;
      compteurs.set(c.statut, (compteurs.get(c.statut) || 0) + 1);
    }
    const max = Math.max(1, ...compteurs.values());
    return this.statutsFiltrables
      .filter((s) => compteurs.has(s))
      .map((s) => ({ label: s, count: compteurs.get(s) || 0, pct: Math.round(((compteurs.get(s) || 0) / max) * 100) }));
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

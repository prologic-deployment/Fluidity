import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { ContratService } from '../../services/contrat.service';
import {
  CATEGORIES_CHANGEMENT,
  SOUS_CATEGORIES_CHANGEMENT,
  TYPES_CHANGEMENT,
  SERVICES_ENVIRONNEMENT_CHANGEMENT,
  sectionsPour,
  TYPES_DISQUE,
  TYPES_STOCKAGE,
  PROTOCOLES_STOCKAGE,
  RETENTION_MAX_PAR_PERIODE,
  RETENTION_PERIODES,
  retentionNombresDisponibles,
  FREQUENCES_SAUVEGARDE,
  OUI_NON,
  IPV4_PATTERN,
  DisqueServeur,
  StockageEntry,
  Changement,
} from '../../models/changement.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

const AUTRE = 'Autre';

/**
 * Rétention sauvegarde : les deux dropdowns vont de pair — soit les deux
 * sont renseignés (ex. 6 | Mois), soit aucun (rétention non précisée).
 */
function retentionCompleteValidator(control: AbstractControl): ValidationErrors | null {
  const nombre = control.get('retentionNombre')?.value;
  const periode = control.get('retentionPeriode')?.value;
  const a = nombre !== null && nombre !== undefined && nombre !== '';
  const b = periode !== null && periode !== undefined && periode !== '';
  return a === b ? null : { retentionIncomplete: true };
}

@Component({
  selector: 'app-create-changement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent],
  templateUrl: './create-changement.component.html',
})
export class CreateChangementComponent implements OnInit {
  form!: FormGroup;
  typesChangement = TYPES_CHANGEMENT;
  categories = CATEGORIES_CHANGEMENT;
  servicesEnvironnement = SERVICES_ENVIRONNEMENT_CHANGEMENT;
  sousCategories: string[] = [];
  contrats: Contrat[] = [];
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;

  // Spécifications — Serveur : disques dynamiques / Sauvegarde : rétention & politique / Stockage : multi-entrées
  typesDisque = TYPES_DISQUE;
  typesStockage = TYPES_STOCKAGE;
  protocolesStockage = PROTOCOLES_STOCKAGE;
  retentionPeriodes = RETENTION_PERIODES;
  frequencesSauvegarde = FREQUENCES_SAUVEGARDE;
  ouiNon = OUI_NON;

  constructor(
    private fb: FormBuilder,
    private changementService: ChangementService,
    private contratService: ContratService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objetChangement: ['', Validators.required],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      serviceEnvironnement: ['', Validators.required],
      serviceEnvironnementAutre: [''],
      categorie: ['', Validators.required],
      categorieAutre: [''],
      sousCategorie: ['', Validators.required],
      sousCategorieAutre: [''],
      prerequisNecessaires: [''],
      planRetourArriere: ['', Validators.required],
      typeChangement: ['Standard', Validators.required],
      contrat: ['', Validators.required],
      general: this.fb.group({
        ressourcesConcernees: [''],
        commentaire: [''],
      }),
      serveur: this.fb.group({
        os: [''],
        hostname: [''],
        cpuCores: [null],
        ramGo: [null],
        // Disques dynamiques : [capacité Go] + [type] (+ précision si 'Autre')
        disques: this.fb.array([]),
      }),
      reseau: this.fb.group({
        vlan: [''],
        // Validation stricte du format IPv4 (octets 0-255)
        adresseIp: ['', Validators.pattern(IPV4_PATTERN)],
        masqueSousReseau: ['', Validators.pattern(IPV4_PATTERN)],
        passerelle: ['', Validators.pattern(IPV4_PATTERN)],
        dnsPrimaire: ['', Validators.pattern(IPV4_PATTERN)],
        dnsSecondaire: ['', Validators.pattern(IPV4_PATTERN)],
        routage: [''],
      }),
      firewall: this.fb.group({
        reglesPareFeu: [''],
        ports: [''],
        nat: [''],
        zones: [''],
        politique: [''],
        vpn: [''],
      }),
      backup: this.fb.group(
        {
          espaceBackupSupplementaireGo: [null],
          retentionNombre: [null],
          retentionPeriode: [''],
          frequenceSauvegarde: [''],
          destinationBackup: [''],
          compression: [''],
          chiffrement: [''],
          licencesNecessaires: [''],
        },
        { validators: [retentionCompleteValidator] }
      ),
      // --- Sections supplémentaires affichées selon la catégorie choisie ---
      // Stockage — FormArray pour plusieurs configurations (Type + Protocole + Autre + capacité)
      stockage: this.fb.array([]),
      iaGpu: this.fb.group({
        typeGpu: [''],
        nombreGpu: [null],
        vramGo: [null],
        framework: [''],
        versionCuda: [''],
        versionPilote: [''],
      }),
      securite: this.fb.group({
        perimetre: [''],
        niveauCriticite: [''],
      }),
    });

    // Initialise avec une première entrée de stockage (au moins une requise quand section visible)
    this.addStockage();

    // "Autre" sur Service / Environnement : champ de précision obligatoire,
    // masqué et réinitialisé dès qu'une autre valeur est choisie
    this.toggleAutreValidator('serviceEnvironnement', 'serviceEnvironnementAutre');

    // Catégorie "Autre" : catégorie + sous-catégorie deviennent des champs
    // libres obligatoires ; sinon la liste de sous-catégories suit la catégorie
    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      const estAutre = cat === AUTRE;
      this.sousCategories = SOUS_CATEGORIES_CHANGEMENT[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      if (!estAutre) this.resetControl(this.form.get('categorieAutre'));
      this.setValidator(this.form.get('categorieAutre'), estAutre);
      this.setValidator(this.form.get('sousCategorie'), !estAutre);
      this.setValidator(this.form.get('sousCategorieAutre'), estAutre);
      // Si on bascule vers Stockage, s'assurer qu'au moins une entrée existe
      if (cat === 'Stockage' && this.stockages.length === 0) {
        this.addStockage();
      }
    });

    // "Autre" sur Sous-catégorie (catégorie standard) : précision obligatoire
    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return; // déjà géré ci-dessus
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
    });

    // Rétention dynamique : la liste des nombres dépend de la période.
    // Tout nombre devenu invalide (ex. 30 avec « Mois ») est réinitialisé.
    this.form.get('backup.retentionPeriode')?.valueChanges.subscribe((periode: string) => {
      this.onRetentionPeriodeChange(periode);
    });

    // Contrats proposés : pour un compte CLIENT, le serveur filtre
    // automatiquement ses propres contrats (restriction côté serveur).
    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  private toggleAutreValidator(controlName: string, autreControlName: string): void {
    this.form.get(controlName)?.valueChanges.subscribe((val: string) => {
      const autre = this.form.get(autreControlName);
      const required = val === AUTRE;
      if (!required) this.resetControl(autre);
      this.setValidator(autre, required);
    });
  }

  private setValidator(control: any, required: boolean): void {
    if (!control) return;
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private resetControl(control: any): void {
    if (!control) return;
    control.setValue('', { emitEvent: false });
    control.markAsUntouched();
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  // --- Disques dynamiques (Spécifications — Serveur) ----------------------

  get disques(): FormArray {
    return this.form.get('serveur.disques') as FormArray;
  }

  addDisque(): void {
    this.disques.push(
      this.fb.group({
        capaciteGo: [null, [Validators.required, Validators.min(1)]],
        type: ['NVMe', Validators.required],
        typePrecision: [''],
      })
    );
  }

  removeDisque(index: number): void {
    this.disques.removeAt(index);
  }

  // --- Stockages multiples (Spécifications — Stockage) -------------------

  get stockages(): FormArray {
    return this.form.get('stockage') as FormArray;
  }

  createStockageGroup(data?: Partial<StockageEntry>): FormGroup {
    return this.fb.group({
      typeStockage: [data?.typeStockage || data?.storageType || '', Validators.required],
      customStorageType: [data?.customStorageType || data?.customType || ''],
      capaciteGo: [data?.capaciteGo ?? null],
      protocole: [data?.protocole || data?.protocol || '', Validators.required],
      customProtocole: [data?.customProtocole || data?.customProtocol || ''],
    });
  }

  addStockage(): void {
    this.stockages.push(this.createStockageGroup());
  }

  removeStockage(index: number): void {
    // Ne pas permettre de supprimer la dernière entrée si au moins une est obligatoire
    if (this.stockages.length <= 1) return;
    this.stockages.removeAt(index);
  }

  /** Précision libre requise uniquement quand le type de stockage est « Autre ». */
  onStockageTypeChange(index: number): void {
    const group = this.stockages.at(index) as FormGroup;
    const custom = group.get('customStorageType');
    const required = group.get('typeStockage')?.value === AUTRE;
    if (!required) {
      custom?.setValue('', { emitEvent: false });
      custom?.markAsUntouched();
    }
    if (custom) {
      custom.setValidators(required ? [Validators.required] : []);
      custom.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Précision libre requise uniquement quand le protocole est « Autre ». */
  onStockageProtocoleChange(index: number): void {
    const group = this.stockages.at(index) as FormGroup;
    const custom = group.get('customProtocole');
    const required = group.get('protocole')?.value === AUTRE;
    if (!required) {
      custom?.setValue('', { emitEvent: false });
      custom?.markAsUntouched();
    }
    if (custom) {
      custom.setValidators(required ? [Validators.required] : []);
      custom.updateValueAndValidity({ emitEvent: false });
    }
  }

  /**
   * Charge des entrées de stockage existantes (legacy ou tableau) dans le FormArray.
   * Utilisé pour l'édition et la compatibilité ascendante.
   */
  patchStockages(stockage: any): void {
    this.stockages.clear();
    if (!stockage) {
      this.addStockage();
      return;
    }
    const entries = Array.isArray(stockage) ? stockage : [stockage];
    if (entries.length === 0) {
      this.addStockage();
      return;
    }
    for (const e of entries) {
      const group = this.createStockageGroup(e);
      // Appliquer les validateurs Autre après patch
      this.stockages.push(group);
    }
    // Déclencher les validateurs custom pour chaque entrée
    for (let i = 0; i < this.stockages.length; i++) {
      this.onStockageTypeChange(i);
      this.onStockageProtocoleChange(i);
    }
  }

  // --- Rétention dynamique (Spécifications — Sauvegarde) -------------------

  /**
   * Nombres proposés pour la période actuellement choisie (1 → max).
   * Getter recalculé par le template : aucune liste dupliquée en mémoire.
   */
  get retentionNombres(): number[] {
    return retentionNombresDisponibles(this.form?.get('backup.retentionPeriode')?.value);
  }

  /** Max de la période courante (0 tant qu'aucune n'est sélectionnée) — pour l'aide contextuelle. */
  get retentionMax(): number {
    const periode = this.form?.get('backup.retentionPeriode')?.value;
    return (periode && RETENTION_MAX_PAR_PERIODE[periode]) || 0;
  }

  /** Changement de période : réinitialise un nombre devenu hors plage. */
  onRetentionPeriodeChange(periode: string): void {
    const nombreCtrl = this.form.get('backup.retentionNombre');
    const max = RETENTION_MAX_PAR_PERIODE[periode];
    if (nombreCtrl?.value && (!max || nombreCtrl.value > max)) {
      nombreCtrl.setValue(null);
      nombreCtrl.markAsUntouched();
    }
  }

  /** Précision libre requise uniquement quand le type de disque est « Autre ». */
  onDisqueTypeChange(index: number): void {
    const group = this.disques.at(index) as FormGroup;
    const precision = group.get('typePrecision');
    const required = group.get('type')?.value === AUTRE;
    if (!required) {
      precision?.setValue('', { emitEvent: false });
      precision?.markAsUntouched();
    }
    if (precision) {
      precision.setValidators(required ? [Validators.required] : []);
      precision.updateValueAndValidity({ emitEvent: false });
    }
  }

  /**
   * Une section de spécifications n'est affichée que si la combinaison
   * catégorie/sous-catégorie la requiert ('general' reste toujours visible ;
   * aucune section spécifique n'est proposée pour une catégorie « Autre »
   * custom). Résolution centralisée dans `sectionsPour` (models/changement) :
   * jamais de champ sans rapport avec la combinaison choisie.
   */
  showSection(section: string): boolean {
    if (section === 'general') return true;
    const cat = this.form?.get('categorie')?.value;
    if (!cat || cat === AUTRE) return false;
    const sous = this.form?.get('sousCategorie')?.value;
    return sectionsPour(cat, sous).includes(section);
  }

  /** Clés des sections réellement envoyées : general + sections visibles. */
  private sectionsVisibles(): string[] {
    return ['general', 'serveur', 'reseau', 'firewall', 'backup', 'stockage', 'iaGpu', 'securite'].filter(
      (s) => this.showSection(s)
    );
  }

  /** Retire les champs vides/null pour ne pas polluer le payload. */
  private clean(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v === '' || v === null || v === undefined) continue;
      out[key] = v;
    }
    return out;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Touche aussi les groupes du FormArray stockage pour afficher les erreurs
      this.stockages.controls.forEach((c) => c.markAllAsTouched());
      return;
    }
    // Validation supplémentaire : si la section stockage est visible, au moins une entrée valide
    if (this.showSection('stockage')) {
      if (this.stockages.length === 0) {
        this.form.markAllAsTouched();
        return;
      }
      // Vérifier que chaque entrée a type et protocole
      let hasInvalid = false;
      this.stockages.controls.forEach((ctrl) => {
        if (ctrl.invalid) {
          ctrl.markAllAsTouched();
          hasInvalid = true;
        }
      });
      if (hasInvalid) return;
    }

    const raw = this.form.value;
    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;

    // Ne persiste que les sections pertinentes pour la catégorie choisie
    const specifications: any = {};
    for (const section of this.sectionsVisibles()) {
      if (section === 'serveur') {
        const serveur: any = this.clean(raw.serveur || {});
        delete serveur.disques; // reconstruit proprement ci-dessous
        const disques: DisqueServeur[] = (raw.serveur?.disques || [])
          .filter((d: any) => d?.capaciteGo && d?.type)
          .map((d: any) => {
            const disque: DisqueServeur = { capaciteGo: Number(d.capaciteGo), type: d.type };
            if (d.type === AUTRE && d.typePrecision) disque.typePrecision = d.typePrecision;
            return disque;
          });
        if (disques.length) serveur.disques = disques;
        if (Object.keys(serveur).length) specifications.serveur = serveur;
      } else if (section === 'backup') {
        const backup: any = this.clean(raw.backup || {});
        delete backup.retentionNombre;
        delete backup.retentionPeriode;
        // Rétention composée « <nombre> <période> », ex. « 6 Mois »
        if (raw.backup?.retentionNombre && raw.backup?.retentionPeriode) {
          backup.retentionSouhaitee = `${raw.backup.retentionNombre} ${raw.backup.retentionPeriode}`;
        }
        if (Object.keys(backup).length) specifications.backup = backup;
      } else if (section === 'stockage') {
        // Stockage — tableau de configurations (FormArray)
        const stockages: StockageEntry[] = (raw.stockage || [])
          .filter((s: any) => s?.typeStockage && s?.protocole)
          .map((s: any) => {
            const entry: StockageEntry = {
              typeStockage: s.typeStockage,
              protocole: s.protocole,
            };
            if (s.capaciteGo !== null && s.capaciteGo !== '' && s.capaciteGo !== undefined) {
              entry.capaciteGo = Number(s.capaciteGo);
            }
            if (s.typeStockage === AUTRE && s.customStorageType) {
              entry.customStorageType = s.customStorageType;
            }
            if (s.protocole === AUTRE && s.customProtocole) {
              entry.customProtocole = s.customProtocole;
            }
            return entry;
          });
        if (stockages.length) {
          // Nettoyer les customs inutiles (sécurité)
          const cleaned = stockages.map((e) => {
            const out: any = { ...e };
            if (out.typeStockage !== AUTRE) delete out.customStorageType;
            if (out.protocole !== AUTRE) delete out.customProtocole;
            // Ne pas envoyer de customs vides
            if (!out.customStorageType) delete out.customStorageType;
            if (!out.customProtocole) delete out.customProtocole;
            if (out.capaciteGo === null || out.capaciteGo === undefined || out.capaciteGo === '') delete out.capaciteGo;
            return out;
          });
          specifications.stockage = cleaned;
        }
      } else {
        const data = this.clean(raw[section] || {});
        if (Object.keys(data).length) specifications[section] = data;
      }
    }

    // Le demandeur (requester) est dérivé côté serveur du compte authentifié (jamais envoyé par le client)
    // Les valeurs « Autre » sont remplacées par leur précision libre avant envoi.
    const payload: Changement = {
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement:
        raw.serviceEnvironnement === AUTRE ? raw.serviceEnvironnementAutre : raw.serviceEnvironnement,
      categorie,
      sousCategorie,
      prerequisNecessaires: raw.prerequisNecessaires || undefined,
      planRetourArriere: raw.planRetourArriere,
      typeChangement: raw.typeChangement,
      contrat: raw.contrat,
      piecesJointes: this.piecesJointes.map((f) => f.url),
      specifications: Object.keys(specifications).length ? specifications : undefined,
    };

    this.loading = true;
    this.error = null;
    this.changementService.create(payload).subscribe({
      next: () => this.router.navigate(['/changements']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création du changement.';
        this.loading = false;
      },
    });
  }
}

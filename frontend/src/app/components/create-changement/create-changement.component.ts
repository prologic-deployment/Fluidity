import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import {
  CATEGORIES_CHANGEMENT,
  SOUS_CATEGORIES_CHANGEMENT,
  TYPES_CHANGEMENT,
  SERVICES_ENVIRONNEMENT_CHANGEMENT,
  SECTIONS_SPECIFICATIONS,
  TYPES_DISQUE,
  RETENTION_NOMBRES,
  RETENTION_PERIODES,
  IPV4_PATTERN,
  DisqueServeur,
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

  // Spécifications — Serveur : disques dynamiques / Sauvegarde : rétention
  typesDisque = TYPES_DISQUE;
  retentionNombres = RETENTION_NOMBRES;
  retentionPeriodes = RETENTION_PERIODES;

  constructor(
    private fb: FormBuilder,
    private changementService: ChangementService,
    private contratService: ContratService,
    private auth: AuthService,
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
      fenetreIntervention: ['', Validators.required],
      prerequisNecessaires: [''],
      planRetourArriere: ['', Validators.required],
      typeChangement: ['Normal', Validators.required],
      contrat: ['', Validators.required],
      general: this.fb.group({
        ressourcesConcernees: [''],
        commentaire: [''],
      }),
      serveur: this.fb.group({
        os: [''],
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
      }),
      backup: this.fb.group(
        {
          espaceBackupSupplementaireGo: [null],
          retentionNombre: [null],
          retentionPeriode: [''],
          licencesNecessaires: [''],
        },
        { validators: [retentionCompleteValidator] }
      ),
      // --- Sections supplémentaires affichées selon la catégorie choisie ---
      baseDeDonnees: this.fb.group({
        moteur: [''],
        version: [''],
        tailleGo: [null],
      }),
      stockage: this.fb.group({
        typeStockage: [''],
        capaciteGo: [null],
        protocole: [''],
      }),
      portailWeb: this.fb.group({
        domaine: [''],
        sslRequis: [''],
        technologie: [''],
      }),
      conteneurs: this.fb.group({
        plateforme: [''],
        nombreReplicas: [null],
        cpuAlloue: [''],
        memoireAllouee: [''],
      }),
      iaGpu: this.fb.group({
        typeGpu: [''],
        nombreGpu: [null],
        framework: [''],
      }),
      securite: this.fb.group({
        perimetre: [''],
        niveauCriticite: [''],
      }),
    });

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
    });

    // "Autre" sur Sous-catégorie (catégorie standard) : précision obligatoire
    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return; // déjà géré ci-dessus
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
    });

    // Contrats du client connecté uniquement (un changement est toujours créé en son nom)
    this.contratService.getAll(this.auth.getEmail() || undefined).subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });

    // Watch serviceEnvironnement changes
    this.form.get('serviceEnvironnement')?.valueChanges.subscribe((val) => {
      if (val !== 'Autre') {
        this.form.get('serviceEnvironnementAutre')?.setValue('');
        this.form.get('serviceEnvironnementAutre')?.clearValidators();
      } else {
        this.form.get('serviceEnvironnementAutre')?.setValidators(Validators.required);
      }
      this.form.get('serviceEnvironnementAutre')?.updateValueAndValidity();
    });

    // Watch categorie changes
    this.form.get('categorie')?.valueChanges.subscribe((val) => {
      if (val !== 'Autre') {
        this.form.get('categorieAutre')?.setValue('');
        this.form.get('categorieAutre')?.clearValidators();
      } else {
        this.form.get('categorieAutre')?.setValidators(Validators.required);
      }
      this.form.get('categorieAutre')?.updateValueAndValidity();
      this.onCategorieChange();
    });
  }

  get disquesArray(): FormArray {
    return this.form.get('serveur.disques') as FormArray;
  }

  addDisk(): void {
    this.disquesArray.push(
      this.fb.group({
        taille: [null],
        type: ['NVMe'],
        typeAutre: [''],
      })
    );
  }

  removeDisk(index: number): void {
    this.disquesArray.removeAt(index);
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
   * Une section de spécifications n'est affichée que si la catégorie
   * sélectionnée la requiert ('general' reste toujours visible ; aucune
   * section spécifique n'est proposée pour une catégorie « Autre » custom).
   */
  showSection(section: string): boolean {
    if (section === 'general') return true;
    const cat = this.form?.get('categorie')?.value;
    if (!cat || cat === AUTRE) return false;
    return (SECTIONS_SPECIFICATIONS[cat] || []).includes(section);
  }

  /** Clés des sections réellement envoyées : general + sections visibles. */
  private sectionsVisibles(): string[] {
    return ['general', 'serveur', 'reseau', 'backup', 'baseDeDonnees', 'stockage', 'portailWeb', 'conteneurs', 'iaGpu', 'securite'].filter(
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
      return;
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
      } else {
        const data = this.clean(raw[section] || {});
        if (Object.keys(data).length) specifications[section] = data;
      }
    }

    // clientId est dérivé côté serveur du compte authentifié (jamais envoyé par le client)
    // Les valeurs « Autre » sont remplacées par leur précision libre avant envoi.
    const payload: Changement = {
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement:
        raw.serviceEnvironnement === AUTRE ? raw.serviceEnvironnementAutre : raw.serviceEnvironnement,
      categorie,
      sousCategorie,
      fenetreIntervention: new Date(raw.fenetreIntervention).toISOString(),
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

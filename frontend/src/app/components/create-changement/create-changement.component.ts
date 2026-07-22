import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  Changement,
} from '../../models/changement.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

const AUTRE = 'Autre';

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
        disqueNvmeGo: [null],
        disqueSasGo: [null],
      }),
      reseau: this.fb.group({
        vlan: [''],
        adresseIp: [''],
        masqueSousReseau: [''],
        passerelle: [''],
      }),
      backup: this.fb.group({
        espaceBackupSupplementaireGo: [null],
        retentionSouhaitee: [''],
        licencesNecessaires: [''],
      }),
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
      const data = this.clean(raw[section] || {});
      if (Object.keys(data).length) specifications[section] = data;
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

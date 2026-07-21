import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import {
  CATEGORIES_CHANGEMENT,
  SOUS_CATEGORIES_CHANGEMENT,
  TYPES_CHANGEMENT,
  SERVICES_ENVIRONNEMENT_CHANGEMENT,
  DISK_TYPES,
  RETENTION_NOMBRES,
  RETENTION_PERIODES,
  Changement,
} from '../../models/changement.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

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
  diskTypes = DISK_TYPES;
  retentionNombres = RETENTION_NOMBRES;
  retentionPeriodes = RETENTION_PERIODES;
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
        disques: this.fb.array([]),
      }),
      reseau: this.fb.group({
        vlan: [''],
        adresseIp: [''],
        masqueSousReseau: [''],
        passerelle: [''],
      }),
      backup: this.fb.group({
        espaceBackupSupplementaireGo: [null],
        retentionNombre: [null],
        retentionPeriode: [''],
        licencesNecessaires: [''],
      }),
    });

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

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  onCategorieChange(): void {
    const cat = this.form.get('categorie')?.value;
    this.sousCategories = SOUS_CATEGORIES_CHANGEMENT[cat] || [];
    this.form.get('sousCategorie')?.setValue('');
  }

  isServiceAutre(): boolean {
    return this.form.get('serviceEnvironnement')?.value === 'Autre';
  }

  isCategorieAutre(): boolean {
    return this.form.get('categorie')?.value === 'Autre';
  }

  showServeurSpecs(): boolean {
    const cat = this.form.get('categorie')?.value;
    return cat === 'VM' || cat === 'Infrastructure';
  }

  showReseauSpecs(): boolean {
    return this.form.get('categorie')?.value === 'Réseau';
  }

  showBackupSpecs(): boolean {
    return this.form.get('categorie')?.value === 'Sauvegarde';
  }

  isDiskTypeAutre(index: number): boolean {
    const disque = this.disquesArray.at(index) as FormGroup;
    return disque.get('type')?.value === 'Autre';
  }

  private clean(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v === '' || v === null || v === undefined) continue;
      out[key] = v;
    }
    return out;
  }

  private cleanArray(arr: any[]): any[] {
    return arr.map(item => this.clean(item)).filter(item => Object.keys(item).length > 0);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const general = this.clean(raw.general);
    const serveur = this.clean(raw.serveur);
    const reseau = this.clean(raw.reseau);
    const backup = this.clean(raw.backup);

    if (serveur.disques) {
      serveur.disques = this.cleanArray(serveur.disques);
      if (serveur.disques.length === 0) delete serveur.disques;
    }

    const specifications: any = {};
    if (Object.keys(general).length) specifications.general = general;
    if (Object.keys(serveur).length) specifications.serveur = serveur;
    if (Object.keys(reseau).length) specifications.reseau = reseau;
    if (Object.keys(backup).length) specifications.backup = backup;

    const payload: Changement = {
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement: raw.serviceEnvironnement,
      serviceEnvironnementAutre: raw.serviceEnvironnement === 'Autre' ? raw.serviceEnvironnementAutre : undefined,
      categorie: raw.categorie,
      categorieAutre: raw.categorie === 'Autre' ? raw.categorieAutre : undefined,
      sousCategorie: raw.sousCategorie,
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

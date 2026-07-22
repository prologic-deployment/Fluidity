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
    });

    // "Autre" activé sur Service/Environnement : rend le champ de précision obligatoire
    this.toggleAutreValidator('serviceEnvironnement', 'serviceEnvironnementAutre');

    // Catégorie "Autre" : plus de liste de sous-catégories, la sous-catégorie devient elle-même
    // un champ libre obligatoire (categorieAutre + sousCategorieAutre)
    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      this.sousCategories = SOUS_CATEGORIES_CHANGEMENT[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      this.setValidator(this.form.get('categorieAutre'), cat === AUTRE);
      this.setValidator(this.form.get('sousCategorie'), cat !== AUTRE);
      this.setValidator(this.form.get('sousCategorieAutre'), cat === AUTRE);
    });

    // "Autre" activé sur Sous-catégorie (cas d'une catégorie normale) : précision obligatoire
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

  /** Abonne un contrôle "Autre" pour qu'il devienne obligatoire quand la valeur sélectionnée est "Autre". */
  private toggleAutreValidator(controlName: string, autreControlName: string): void {
    this.form.get(controlName)?.valueChanges.subscribe((val: string) => {
      this.setValidator(this.form.get(autreControlName), val === AUTRE);
    });
  }

  private setValidator(control: any, required: boolean): void {
    if (!control) return;
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
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
    const general = this.clean(raw.general);
    const serveur = this.clean(raw.serveur);
    const reseau = this.clean(raw.reseau);
    const backup = this.clean(raw.backup);

    const specifications: any = {};
    if (Object.keys(general).length) specifications.general = general;
    if (Object.keys(serveur).length) specifications.serveur = serveur;
    if (Object.keys(reseau).length) specifications.reseau = reseau;
    if (Object.keys(backup).length) specifications.backup = backup;

    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;

    // clientId est dérivé côté serveur du compte authentifié (jamais envoyé par le client)
    const payload: Changement = {
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement: raw.serviceEnvironnement === AUTRE ? raw.serviceEnvironnementAutre : raw.serviceEnvironnement,
      categorie,
      sousCategorie,
      fenetreIntervention: raw.fenetreIntervention,
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

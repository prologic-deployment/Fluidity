import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { ContratService } from '../../services/contrat.service';
import {
  PRIORITES,
  CATEGORIES,
  SOUS_CATEGORIES,
  TYPES_DEMANDE,
  SERVICES_ENVIRONNEMENT,
  Demande,
} from '../../models/demande.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent],
  templateUrl: './create-demande.component.html',
})
export class CreateDemandeComponent implements OnInit {
  form!: FormGroup;
  priorites = PRIORITES;
  categories = CATEGORIES;
  typesDemande = TYPES_DEMANDE;
  servicesEnvironnement = SERVICES_ENVIRONNEMENT;
  sousCategories: string[] = [];
  contrats: Contrat[] = [];
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private contratService: ContratService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objet: ['', Validators.required],
      typeDemande: ['', Validators.required],
      typeDemandeAutre: [''],
      serviceEnvironnement: ['', Validators.required],
      serviceEnvironnementAutre: [''],
      categorie: ['', Validators.required],
      categorieAutre: [''],
      sousCategorie: ['', Validators.required],
      sousCategorieAutre: [''],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      prioriteSouhaitee: ['Standard', Validators.required],
      informationsComplementaires: [''],
      contrat: ['', Validators.required],
    });

    // "Autre" activé sur Type / Service-Environnement : rend le champ de précision obligatoire
    this.toggleAutreValidator('typeDemande', 'typeDemandeAutre');
    this.toggleAutreValidator('serviceEnvironnement', 'serviceEnvironnementAutre');

    // Catégorie "Autre" : plus de liste de sous-catégories, la sous-catégorie devient elle-même
    // un champ libre obligatoire (categorieAutre + sousCategorieAutre)
    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      const estAutre = cat === AUTRE;
      this.sousCategories = SOUS_CATEGORIES[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      if (!estAutre) this.resetControl(this.form.get('categorieAutre')); // masqué => réinitialisé
      this.setValidator(this.form.get('categorieAutre'), estAutre);
      this.setValidator(this.form.get('sousCategorie'), !estAutre);
      this.setValidator(this.form.get('sousCategorieAutre'), estAutre);
    });

    // "Autre" activé sur Sous-catégorie (cas d'une catégorie normale) : précision obligatoire
    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return; // déjà géré ci-dessus
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
    });

    // Contrats proposés : pour un compte CLIENT, le serveur filtre
    // automatiquement ses propres contrats (restriction côté serveur).
    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  /**
   * Abonne un contrôle "Autre" : le champ de précision devient obligatoire
   * quand "Autre" est sélectionné, et il est masqué + réinitialisé dès qu'une
   * autre valeur est choisie.
   */
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

  /** Vide un champ masqué et efface son état de validation. */
  private resetControl(control: any): void {
    if (!control) return;
    control.setValue('', { emitEvent: false });
    control.markAsUntouched();
  }

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;

    // Le demandeur (requester) est dérivé côté serveur du compte authentifié (jamais envoyé par le client)
    const payload: Demande = {
      objet: raw.objet,
      typeDemande: raw.typeDemande === AUTRE ? raw.typeDemandeAutre : raw.typeDemande,
      serviceEnvironnement: raw.serviceEnvironnement === AUTRE ? raw.serviceEnvironnementAutre : raw.serviceEnvironnement,
      categorie,
      sousCategorie,
      descriptionDetaillee: raw.descriptionDetaillee,
      prioriteSouhaitee: raw.prioriteSouhaitee,
      contrat: raw.contrat,
      informationsComplementaires: raw.informationsComplementaires || undefined,
      piecesJointes: this.piecesJointes.map((f) => f.url),
    };

    this.loading = true;
    this.error = null;
    this.demandeService.create(payload).subscribe({
      next: () => this.router.navigate(['/demandes']),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la création de la demande.';
        this.loading = false;
      },
    });
  }
}

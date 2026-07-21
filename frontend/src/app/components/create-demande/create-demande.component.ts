import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemandeService } from '../../services/demande.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
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
    private auth: AuthService,
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
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      prioriteSouhaitee: ['Standard', Validators.required],
      informationsComplementaires: [''],
      contrat: ['', Validators.required],
    });

    // Contrats du client connecté uniquement
    this.contratService.getAll(this.auth.getEmail() || undefined).subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });

    // Watch typeDemande changes
    this.form.get('typeDemande')?.valueChanges.subscribe((val) => {
      if (val !== 'Autre') {
        this.form.get('typeDemandeAutre')?.setValue('');
        this.form.get('typeDemandeAutre')?.clearValidators();
      } else {
        this.form.get('typeDemandeAutre')?.setValidators(Validators.required);
      }
      this.form.get('typeDemandeAutre')?.updateValueAndValidity();
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

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
  }

  onCategorieChange(): void {
    const cat = this.form.get('categorie')?.value;
    this.sousCategories = SOUS_CATEGORIES[cat] || [];
    this.form.get('sousCategorie')?.setValue('');
  }

  isTypeAutre(): boolean {
    return this.form.get('typeDemande')?.value === 'Autre';
  }

  isServiceAutre(): boolean {
    return this.form.get('serviceEnvironnement')?.value === 'Autre';
  }

  isCategorieAutre(): boolean {
    return this.form.get('categorie')?.value === 'Autre';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Demande = {
      objet: raw.objet,
      typeDemande: raw.typeDemande,
      typeDemandeAutre: raw.typeDemande === 'Autre' ? raw.typeDemandeAutre : undefined,
      serviceEnvironnement: raw.serviceEnvironnement,
      serviceEnvironnementAutre: raw.serviceEnvironnement === 'Autre' ? raw.serviceEnvironnementAutre : undefined,
      categorie: raw.categorie,
      categorieAutre: raw.categorie === 'Autre' ? raw.categorieAutre : undefined,
      sousCategorie: raw.sousCategorie,
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

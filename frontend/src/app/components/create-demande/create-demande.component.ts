import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UploadedFile } from '../../services/upload.service';
import { FormStepperComponent, StepperStep } from '../shared/form-stepper.component';
import { markTouched, scrollToFirstInvalid, stepValid } from '../../utils/form-stepper.util';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent, TranslatePipe, FormStepperComponent],
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

  steps: StepperStep[] = [
    { id: 'general', labelKey: 'demande.step1', hintKey: 'demande.step1Hint' },
    { id: 'classification', labelKey: 'demande.step2', hintKey: 'demande.step2Hint' },
    { id: 'details', labelKey: 'demande.step3', hintKey: 'demande.step3Hint' },
  ];
  currentStep = 0;
  maxReached = 0;

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private contratService: ContratService,
    private auth: AuthService,
    private router: Router,
    private el: ElementRef
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

    this.toggleAutreValidator('typeDemande', 'typeDemandeAutre');
    this.toggleAutreValidator('serviceEnvironnement', 'serviceEnvironnementAutre');

    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      this.sousCategories = SOUS_CATEGORIES[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      this.setValidator(this.form.get('categorieAutre'), cat === AUTRE);
      this.setValidator(this.form.get('sousCategorie'), cat !== AUTRE);
      this.setValidator(this.form.get('sousCategorieAutre'), cat === AUTRE);
    });

    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return;
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
    });

    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

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

  /* ---- Navigation par étapes ---- */
  private stepControls(step: number): AbstractControl[] {
    const f = this.form;
    switch (step) {
      case 0:
        return [f.get('objet')!, f.get('typeDemande')!, f.get('typeDemandeAutre')!, f.get('serviceEnvironnement')!, f.get('serviceEnvironnementAutre')!];
      case 1:
        return [f.get('categorie')!, f.get('categorieAutre')!, f.get('sousCategorie')!, f.get('sousCategorieAutre')!, f.get('prioriteSouhaitee')!, f.get('contrat')!];
      default:
        return [f.get('descriptionDetaillee')!, f.get('informationsComplementaires')!];
    }
  }

  next(): void {
    const controls = this.stepControls(this.currentStep);
    if (!stepValid(controls)) {
      markTouched(controls);
      scrollToFirstInvalid(this.el.nativeElement);
      return;
    }
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.maxReached = Math.max(this.maxReached, this.currentStep);
      this.scrollTop();
    }
  }

  prev(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.scrollTop();
    }
  }

  goToStep(i: number): void {
    if (i < this.maxReached) {
      this.currentStep = i;
      this.scrollTop();
    }
  }

  private scrollTop(): void {
    setTimeout(() => this.el.nativeElement?.querySelector('main, form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  get canSubmit(): boolean {
    return stepValid(this.stepControls(this.currentStep));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
    const sousCategorie = raw.sousCategorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;

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

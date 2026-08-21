import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChangementService } from '../../services/changement.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import {
  CATEGORIES_CHANGEMENT,
  SOUS_CATEGORIES_CHANGEMENT,
  TYPES_CHANGEMENT,
  SERVICES_ENVIRONNEMENT_CHANGEMENT,
  RETENTION_MAX_PAR_PERIODE,
  Changement,
} from '../../models/changement.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UploadedFile } from '../../services/upload.service';
import {
  buildSpecificationControls,
  resetSpecsIncompatibles,
  resolveCategorieSous,
  serializeSpecifications,
  showSpecSection,
} from '../../utils/specifications-form.factory';
import { SpecificationsFormComponent } from '../shared/specifications-form.component';
import { FormStepperComponent, StepperStep } from '../shared/form-stepper.component';
import { markTouched, scrollToFirstInvalid, stepValid } from '../../utils/form-stepper.util';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-changement',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    DropzoneComponent,
    TranslatePipe,
    SpecificationsFormComponent,
    FormStepperComponent,
  ],
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

  steps: StepperStep[] = [
    { id: 'general', labelKey: 'changement.step1', hintKey: 'changement.step1Hint' },
    { id: 'planning', labelKey: 'changement.step2', hintKey: 'changement.step2Hint' },
    { id: 'specs', labelKey: 'changement.step3', hintKey: 'changement.step3Hint' },
    { id: 'attachments', labelKey: 'changement.step4', hintKey: 'changement.step4Hint' },
  ];
  currentStep = 0;
  maxReached = 0;

  constructor(
    private fb: FormBuilder,
    private changementService: ChangementService,
    private contratService: ContratService,
    private auth: AuthService,
    private router: Router,
    private el: ElementRef
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
      ...buildSpecificationControls(this.fb),
    });

    this.ensureStockage();
    this.toggleAutreValidator('serviceEnvironnement', 'serviceEnvironnementAutre');

    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      const estAutre = cat === AUTRE;
      this.sousCategories = SOUS_CATEGORIES_CHANGEMENT[cat] || [];
      this.form.get('sousCategorie')?.setValue('');
      this.form.get('sousCategorieAutre')?.setValue('');
      if (!estAutre) this.resetControl(this.form.get('categorieAutre'));
      this.setValidator(this.form.get('categorieAutre'), estAutre);
      this.setValidator(this.form.get('sousCategorie'), !estAutre);
      this.setValidator(this.form.get('sousCategorieAutre'), estAutre);
      if (cat === 'Stockage') this.ensureStockage();
      resetSpecsIncompatibles(this.form);
    });

    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return;
      this.setValidator(this.form.get('sousCategorieAutre'), val === AUTRE);
      resetSpecsIncompatibles(this.form);
    });

    this.form.get('backup.retentionPeriode')?.valueChanges.subscribe((periode: string) => {
      const nombreCtrl = this.form.get('backup.retentionNombre');
      const max = RETENTION_MAX_PAR_PERIODE[periode];
      if (nombreCtrl?.value && (!max || nombreCtrl.value > max)) {
        nombreCtrl.setValue(null);
        nombreCtrl.markAsUntouched();
      }
    });

    this.contratService.getAll().subscribe({
      next: (data) => (this.contrats = data),
      error: () => (this.contrats = []),
    });
  }

  private ensureStockage(): void {
    const arr = this.form.get('stockage') as FormArray;
    if (arr.length === 0) {
      arr.push(
        this.fb.group({
          typeStockage: [''],
          customStorageType: [''],
          capaciteGo: [null],
          protocole: [''],
          customProtocole: [''],
        })
      );
    }
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

  isSectionVisible(section: string): boolean {
    return showSpecSection(this.form, section);
  }

  /* ---- Navigation par étapes ---- */
  private stepControls(step: number): AbstractControl[] {
    const f = this.form;
    switch (step) {
      case 0:
        return [f.get('objetChangement')!, f.get('descriptionDetaillee')!, f.get('serviceEnvironnement')!, f.get('serviceEnvironnementAutre')!, f.get('typeChangement')!, f.get('contrat')!];
      case 1:
        return [f.get('categorie')!, f.get('categorieAutre')!, f.get('sousCategorie')!, f.get('sousCategorieAutre')!, f.get('planRetourArriere')!, f.get('prerequisNecessaires')!];
      case 2:
        return this.specControls();
      default:
        return [];
    }
  }

  private specControls(): AbstractControl[] {
    const controls: AbstractControl[] = [];
    for (const s of ['general', 'serveur', 'reseau', 'firewall', 'backup', 'iaGpu', 'securite']) {
      if (this.isSectionVisible(s)) controls.push(this.form.get(s)!);
    }
    if (this.isSectionVisible('stockage')) {
      (this.form.get('stockage') as FormArray).controls.forEach((c) => controls.push(c));
    }
    return controls;
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

  submit(): void {
    const stockages = this.form.get('stockage') as FormArray;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      stockages.controls.forEach((c) => c.markAllAsTouched());
      return;
    }
    if (this.isSectionVisible('stockage') && stockages.invalid) {
      stockages.controls.forEach((c) => c.markAllAsTouched());
      return;
    }

    const raw = this.form.value;
    const { categorie, sousCategorie } = resolveCategorieSous(raw);
    const payload: Changement = {
      objetChangement: raw.objetChangement,
      descriptionDetaillee: raw.descriptionDetaillee,
      serviceEnvironnement: raw.serviceEnvironnement === AUTRE ? raw.serviceEnvironnementAutre : raw.serviceEnvironnement,
      categorie,
      sousCategorie,
      prerequisNecessaires: raw.prerequisNecessaires || undefined,
      planRetourArriere: raw.planRetourArriere,
      typeChangement: raw.typeChangement,
      contrat: raw.contrat,
      piecesJointes: this.piecesJointes.map((f) => f.url),
      specifications: serializeSpecifications(this.form),
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

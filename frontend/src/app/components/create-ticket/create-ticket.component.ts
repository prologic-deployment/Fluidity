import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { ContratService } from '../../services/contrat.service';
import { AuthService } from '../../services/auth.service';
import { CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import {
  IMPACTS_TICKET,
  URGENCES_TICKET,
  calculatePriority,
  PrioriteTicket,
  Ticket,
} from '../../models/ticket.model';
import { RETENTION_MAX_PAR_PERIODE } from '../../models/changement.model';
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
  selector: 'app-create-ticket',
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
  templateUrl: './create-ticket.component.html',
})
export class CreateTicketComponent implements OnInit {
  form!: FormGroup;
  categories = CATEGORIES;
  impacts = IMPACTS_TICKET;
  urgences = URGENCES_TICKET;
  sousCategories: string[] = [];
  contrats: Contrat[] = [];
  piecesJointes: UploadedFile[] = [];
  loading = false;
  error: string | null = null;
  editId: string | null = null;

  steps: StepperStep[] = [
    { id: 'general', labelKey: 'ticket.step1', hintKey: 'ticket.step1Hint' },
    { id: 'impact', labelKey: 'ticket.step2', hintKey: 'ticket.step2Hint' },
    { id: 'specs', labelKey: 'ticket.step3', hintKey: 'ticket.step3Hint' },
    { id: 'attachments', labelKey: 'ticket.step4', hintKey: 'ticket.step4Hint' },
  ];
  currentStep = 0;
  maxReached = 0;

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private contratService: ContratService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private el: ElementRef
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objet: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      descriptionDetaillee: ['', [Validators.required, Validators.minLength(10)]],
      categorie: ['', Validators.required],
      categorieAutre: [''],
      sousCategorie: ['', Validators.required],
      sousCategorieAutre: [''],
      impact: ['', Validators.required],
      urgence: ['', Validators.required],
      contrat: ['', Validators.required],
      ...buildSpecificationControls(this.fb),
    });

    this.ensureStockage();

    this.form.get('categorie')?.valueChanges.subscribe((cat: string) => {
      const estAutre = cat === AUTRE;
      this.sousCategories = SOUS_CATEGORIES[cat] || [];
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

    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.route.snapshot.routeConfig?.path?.includes('modifier')) {
      this.editId = id;
      this.loadTicket(id);
    }
  }

  private loadTicket(id: string): void {
    this.ticketService.getById(id).subscribe({
      next: (t) => {
        const catKnown = CATEGORIES.includes(t.categorie);
        const cat = catKnown ? t.categorie : AUTRE;
        this.sousCategories = SOUS_CATEGORIES[cat] || [];
        const sousKnown = this.sousCategories.includes(t.sousCategorie);
        this.form.patchValue(
          {
            objet: t.objet,
            descriptionDetaillee: t.descriptionDetaillee,
            categorie: cat,
            categorieAutre: catKnown ? '' : t.categorie,
            sousCategorie: sousKnown ? t.sousCategorie : AUTRE,
            sousCategorieAutre: sousKnown ? '' : t.sousCategorie,
            impact: t.impact,
            urgence: t.urgence,
            contrat: typeof t.contrat === 'string' ? t.contrat : (t.contrat as any)?._id,
          },
          { emitEvent: false }
        );
        if (t.specifications) {
          this.form.patchValue(t.specifications);
          const specs: any = t.specifications;
          if (specs.backup?.retentionSouhaitee) {
            const [n, ...rest] = String(specs.backup.retentionSouhaitee).split(' ');
            this.form.get('backup')?.patchValue({ retentionNombre: Number(n) || null, retentionPeriode: rest.join(' ') });
          }
          if (specs.stockage) {
            const arr = this.form.get('stockage') as FormArray;
            arr.clear();
            const entries = Array.isArray(specs.stockage) ? specs.stockage : [specs.stockage];
            for (const e of entries) {
              arr.push(
                this.fb.group({
                  typeStockage: [e.typeStockage || '', Validators.required],
                  customStorageType: [e.customStorageType || ''],
                  capaciteGo: [e.capaciteGo ?? null],
                  protocole: [e.protocole || '', Validators.required],
                  customProtocole: [e.customProtocole || ''],
                })
              );
            }
            if (arr.length === 0) this.ensureStockage();
          }
          if (specs.serveur?.disques?.length) {
            const disques = this.form.get('serveur.disques') as FormArray;
            disques.clear();
            for (const d of specs.serveur.disques) {
              disques.push(
                this.fb.group({
                  capaciteGo: [d.capaciteGo, [Validators.required, Validators.min(1)]],
                  type: [d.type, Validators.required],
                  typePrecision: [d.typePrecision || ''],
                })
              );
            }
          }
        }
      },
      error: () => (this.error = 'Impossible de charger le ticket.'),
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

  get prioriteCalculee(): PrioriteTicket | null {
    return calculatePriority(this.form?.get('impact')?.value, this.form?.get('urgence')?.value);
  }

  isSectionVisible(section: string): boolean {
    return showSpecSection(this.form, section);
  }

  /* ---- Navigation par étapes ---- */
  private stepControls(step: number): AbstractControl[] {
    const f = this.form;
    switch (step) {
      case 0:
        return [f.get('objet')!, f.get('descriptionDetaillee')!, f.get('categorie')!, f.get('categorieAutre')!, f.get('sousCategorie')!, f.get('sousCategorieAutre')!];
      case 1:
        return [f.get('impact')!, f.get('urgence')!, f.get('contrat')!];
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
    const payload: Partial<Ticket> = {
      objet: raw.objet.trim(),
      descriptionDetaillee: raw.descriptionDetaillee.trim(),
      categorie,
      sousCategorie,
      impact: raw.impact,
      urgence: raw.urgence,
      contrat: raw.contrat,
      specifications: serializeSpecifications(this.form) || {},
    };
    // Ne remplacer les pièces jointes que si de nouveaux fichiers ont été
    // déposés (préserve les pièces existantes en mode édition).
    if (this.piecesJointes.length > 0) {
      payload.piecesJointes = this.piecesJointes.map((f) => f.url);
    }

    this.loading = true;
    this.error = null;
    const req$ = this.editId ? this.ticketService.update(this.editId, payload) : this.ticketService.create(payload);
    req$.subscribe({
      next: (ticket) => this.router.navigate(['/tickets', ticket._id || this.editId]),
      error: (err) => {
        this.error = err.error?.message || (this.editId ? 'Erreur lors de la modification du ticket.' : 'Erreur lors de la création du ticket.');
        this.loading = false;
      },
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { ContratService } from '../../services/contrat.service';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { SpecificationsFormComponent } from '../shared/specifications-form.component';
import { UploadedFile } from '../../services/upload.service';
import { CATEGORIES, SOUS_CATEGORIES } from '../../models/demande.model';
import {
  IMPACTS_TICKET,
  URGENCES_TICKET,
  calculatePriority,
  PrioriteTicket,
} from '../../models/ticket.model';
import {
  buildSpecificationControls,
  resetSpecsIncompatibles,
  resolveCategorieSous,
  serializeSpecifications,
  showSpecSection,
} from '../../utils/specifications-form.factory';
import { RETENTION_MAX_PAR_PERIODE } from '../../models/changement.model';

const AUTRE = 'Autre';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DropzoneComponent, SpecificationsFormComponent],
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

  constructor(
    private fb: FormBuilder,
    private tickets: TicketService,
    private contratService: ContratService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      objet: ['', [Validators.required, Validators.maxLength(200)]],
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
      this.setRequired('categorieAutre', estAutre);
      this.setRequired('sousCategorie', !estAutre);
      this.setRequired('sousCategorieAutre', estAutre);
      if (cat === 'Stockage') this.ensureStockage();
      resetSpecsIncompatibles(this.form);
    });
    this.form.get('sousCategorie')?.valueChanges.subscribe((val: string) => {
      if (this.form.get('categorie')?.value === AUTRE) return;
      this.setRequired('sousCategorieAutre', val === AUTRE);
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
      next: (data) => (this.contrats = data.filter((c) => c.statut === 'Actif')),
      error: () => (this.contrats = []),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.route.snapshot.routeConfig?.path?.includes('modifier')) {
      this.editId = id;
      this.loadTicket(id);
    }
  }

  get prioriteCalculee(): PrioriteTicket | null {
    return calculatePriority(this.form?.get('impact')?.value, this.form?.get('urgence')?.value);
  }

  private loadTicket(id: string): void {
    this.tickets.getById(id).subscribe({
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

  onPiecesJointesChange(files: UploadedFile[]): void {
    this.piecesJointes = files;
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

  private setRequired(name: string, required: boolean): void {
    const c = this.form.get(name);
    if (!c) return;
    c.setValidators(required ? [Validators.required] : []);
    c.updateValueAndValidity({ emitEvent: false });
  }

  private resetControl(control: any): void {
    if (!control) return;
    control.setValue('', { emitEvent: false });
    control.markAsUntouched();
  }

  submit(): void {
    const stockages = this.form.get('stockage') as FormArray;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      stockages.controls.forEach((c) => c.markAllAsTouched());
      return;
    }
    if (showSpecSection(this.form, 'stockage') && stockages.invalid) {
      stockages.controls.forEach((c) => c.markAllAsTouched());
      return;
    }

    const raw = this.form.value;
    const { categorie, sousCategorie } = resolveCategorieSous(raw);
    const payload = {
      objet: raw.objet.trim(),
      descriptionDetaillee: raw.descriptionDetaillee.trim(),
      categorie,
      sousCategorie,
      impact: raw.impact,
      urgence: raw.urgence,
      contrat: raw.contrat,
      piecesJointes: this.piecesJointes.map((f) => f.url),
      specifications: serializeSpecifications(this.form),
    };

    this.loading = true;
    this.error = null;
    const req$ = this.editId ? this.tickets.update(this.editId, payload) : this.tickets.create(payload);
    req$.subscribe({
      next: (t) => this.router.navigate(['/tickets', t._id || this.editId]),
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l’enregistrement du ticket.';
        this.loading = false;
      },
    });
  }
}

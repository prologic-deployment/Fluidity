import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  RETENTION_PERIODES,
  TYPES_DISQUE,
  TYPES_STOCKAGE,
  PROTOCOLES_STOCKAGE,
  FREQUENCES_SAUVEGARDE,
  OUI_NON,
  Changement,
} from '../../models/changement.model';
import { Contrat } from '../../models/contrat.model';
import { DropzoneComponent } from '../shared/dropzone.component';
import { UploadedFile } from '../../services/upload.service';
import {
  buildSpecificationControls,
  resetSpecsIncompatibles,
  resolveCategorieSous,
  serializeSpecifications,
  showSpecSection,
  showSpecField,
} from '../../utils/specifications-form.factory';

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

  // Options des specs
  typesDisque = TYPES_DISQUE;
  retentionPeriodes = RETENTION_PERIODES;
  typesStockage = TYPES_STOCKAGE;
  protocolesStockage = PROTOCOLES_STOCKAGE;
  frequencesSauvegarde = FREQUENCES_SAUVEGARDE;
  ouiNon = OUI_NON;

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

    this.contratService.getAll(this.auth.getEmail() || undefined).subscribe({
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

  // --- Helpers pour le template ---
  isSectionVisible(section: string): boolean {
    return showSpecSection(this.form, section);
  }

  isFieldVisible(section: string, champ: string): boolean {
    return showSpecField(this.form, section, champ);
  }

  get disques(): FormArray {
    return this.form.get('serveur.disques') as FormArray;
  }

  addDisque(): void {
    this.disques.push(this.fb.group({ capaciteGo: [null], type: ['NVMe'], typePrecision: [''] }));
  }

  removeDisque(index: number): void {
    this.disques.removeAt(index);
  }

  get stockages(): FormArray {
    return this.form.get('stockage') as FormArray;
  }

  addStockage(): void {
    this.stockages.push(
      this.fb.group({ typeStockage: [''], customStorageType: [''], capaciteGo: [null], protocole: [''], customProtocole: [''] })
    );
  }

  removeStockage(index: number): void {
    this.stockages.removeAt(index);
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

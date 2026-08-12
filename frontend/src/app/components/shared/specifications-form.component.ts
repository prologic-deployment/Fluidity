import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlContainer, FormArray, FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  TYPES_DISQUE,
  TYPES_STOCKAGE,
  PROTOCOLES_STOCKAGE,
  RETENTION_MAX_PAR_PERIODE,
  RETENTION_PERIODES,
  retentionNombresDisponibles,
  FREQUENCES_SAUVEGARDE,
  OUI_NON,
  StockageEntry,
} from '../../models/changement.model';
import { showSpecField, showSpecSection } from '../../utils/specifications-form.factory';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

const AUTRE = 'Autre';

/**
 * Sections dynamiques partagées — même UI et mêmes règles pour
 * Nouveau Changement et Nouveau Ticket.
 */
@Component({
  selector: 'app-specifications-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...I18N_IMPORTS],
  templateUrl: './specifications-form.component.html',
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
})
export class SpecificationsFormComponent implements OnInit {
  @Input() form!: FormGroup;

  typesDisque = TYPES_DISQUE;
  typesStockage = TYPES_STOCKAGE;
  protocolesStockage = PROTOCOLES_STOCKAGE;
  retentionPeriodes = RETENTION_PERIODES;
  frequencesSauvegarde = FREQUENCES_SAUVEGARDE;
  ouiNon = OUI_NON;

  constructor(private fb: FormBuilder, private parent: FormGroupDirective) {}

  ngOnInit(): void {
    if (!this.form) this.form = this.parent.form;
  }

  showSection(section: string): boolean {
    return showSpecSection(this.form, section);
  }

  showField(section: string, champ: string): boolean {
    return showSpecField(this.form, section, champ);
  }

  get disques(): FormArray {
    return this.form.get('serveur.disques') as FormArray;
  }

  addDisque(): void {
    this.disques.push(
      this.fb.group({
        capaciteGo: [null, [Validators.required, Validators.min(1)]],
        type: ['NVMe', Validators.required],
        typePrecision: [''],
      })
    );
  }

  removeDisque(index: number): void {
    this.disques.removeAt(index);
  }

  onDisqueTypeChange(index: number): void {
    const group = this.disques.at(index) as FormGroup;
    const precision = group.get('typePrecision');
    const required = group.get('type')?.value === AUTRE;
    if (!required) {
      precision?.setValue('', { emitEvent: false });
      precision?.markAsUntouched();
    }
    if (precision) {
      precision.setValidators(required ? [Validators.required] : []);
      precision.updateValueAndValidity({ emitEvent: false });
    }
  }

  get stockages(): FormArray {
    return this.form.get('stockage') as FormArray;
  }

  createStockageGroup(data?: Partial<StockageEntry>): FormGroup {
    return this.fb.group({
      typeStockage: [data?.typeStockage || data?.storageType || '', Validators.required],
      customStorageType: [data?.customStorageType || data?.customType || ''],
      capaciteGo: [data?.capaciteGo ?? null],
      protocole: [data?.protocole || data?.protocol || '', Validators.required],
      customProtocole: [data?.customProtocole || data?.customProtocol || ''],
    });
  }

  addStockage(): void {
    this.stockages.push(this.createStockageGroup());
  }

  removeStockage(index: number): void {
    if (this.stockages.length <= 1) return;
    this.stockages.removeAt(index);
  }

  onStockageTypeChange(index: number): void {
    const group = this.stockages.at(index) as FormGroup;
    const custom = group.get('customStorageType');
    const required = group.get('typeStockage')?.value === AUTRE;
    if (!required) {
      custom?.setValue('', { emitEvent: false });
      custom?.markAsUntouched();
    }
    if (custom) {
      custom.setValidators(required ? [Validators.required] : []);
      custom.updateValueAndValidity({ emitEvent: false });
    }
  }

  onStockageProtocoleChange(index: number): void {
    const group = this.stockages.at(index) as FormGroup;
    const custom = group.get('customProtocole');
    const required = group.get('protocole')?.value === AUTRE;
    if (!required) {
      custom?.setValue('', { emitEvent: false });
      custom?.markAsUntouched();
    }
    if (custom) {
      custom.setValidators(required ? [Validators.required] : []);
      custom.updateValueAndValidity({ emitEvent: false });
    }
  }

  patchStockages(stockage: any): void {
    this.stockages.clear();
    const entries = !stockage ? [] : Array.isArray(stockage) ? stockage : [stockage];
    if (entries.length === 0) {
      this.addStockage();
      return;
    }
    for (const e of entries) this.stockages.push(this.createStockageGroup(e));
    for (let i = 0; i < this.stockages.length; i++) {
      this.onStockageTypeChange(i);
      this.onStockageProtocoleChange(i);
    }
  }

  get retentionNombres(): number[] {
    return retentionNombresDisponibles(this.form?.get('backup.retentionPeriode')?.value);
  }

  get retentionMax(): number {
    const periode = this.form?.get('backup.retentionPeriode')?.value;
    return (periode && RETENTION_MAX_PAR_PERIODE[periode]) || 0;
  }
}

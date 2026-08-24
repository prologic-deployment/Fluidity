import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlContainer, FormArray, FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  RETENTION_MAX_PAR_PERIODE,
  RETENTION_PERIODES,
  retentionNombresDisponibles,
  StockageEntry,
  TYPES_DISQUE,
} from '../../models/changement.model';
import {
  configureSpecificationValidators,
  isSpecificationFieldVisible,
  showSpecSection,
  watchSpecificationDependencies,
} from '../../utils/specifications-form.factory';
import { fieldsForSection, SPECIFICATION_SECTIONS, SpecificationField, STORAGE_FIELDS } from '../../utils/specifications-form.config';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Shared dynamic specification form for Demande, Changement and Incident.
 * The catalogue controls the active section; field metadata controls the
 * input, options, guidance and reusable validators.
 */
@Component({
  selector: 'app-specifications-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './specifications-form.component.html',
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
})
export class SpecificationsFormComponent implements OnInit {
  @Input() form!: FormGroup;

  readonly sections = SPECIFICATION_SECTIONS;
  readonly storageFields = STORAGE_FIELDS;
  readonly diskTypes = TYPES_DISQUE;
  readonly retentionPeriods = RETENTION_PERIODES;

  constructor(private fb: FormBuilder, private parent: FormGroupDirective) {}

  ngOnInit(): void {
    if (!this.form) this.form = this.parent.form;
    watchSpecificationDependencies(this.form);
  }

  showSection(section: string): boolean {
    return showSpecSection(this.form, section);
  }

  showField(section: string, key: string): boolean {
    return isSpecificationFieldVisible(this.form, section, key);
  }

  fields(section: string): SpecificationField[] {
    return fieldsForSection(section).filter((field) => field.key !== 'disques');
  }

  control(section: string, key?: string): any {
    return this.form.get(key ? `${section}.${key}` : section);
  }

  fieldError(field: SpecificationField, control: any): string {
    if (control?.hasError('required')) return 'common.required';
    return field.errorKey || this.defaultErrorKey(field);
  }

  private defaultErrorKey(field: SpecificationField): string {
    if (field.validators?.includes('ipv4')) return 'specs.ipv4Invalid';
    if (field.validators?.includes('cidr')) return 'specs.cidrInvalid';
    if (field.validators?.includes('hostname') || field.validators?.includes('hostnameOrIpv4')) return 'specs.hostInvalid';
    if (field.validators?.includes('port') || field.validators?.includes('portList')) return 'specs.portInvalid';
    if (field.validators?.includes('vlan')) return 'specs.vlanInvalid';
    if (field.validators?.includes('version')) return 'specs.versionInvalid';
    if (field.min !== undefined || field.max !== undefined) return 'specs.numberInvalid';
    return 'common.required';
  }

  isRequired(field: SpecificationField, control: any): boolean {
    return !!control?.hasValidator?.(Validators.required) || (!!field.required && (!field.requiredWhen || field.requiredWhen(this.form)));
  }

  get disques(): FormArray {
    return this.form.get('serveur.disques') as FormArray;
  }

  addDisque(): void {
    this.disques.push(
      this.fb.group({
        capaciteGo: [null],
        type: ['NVMe'],
        typePrecision: [''],
      })
    );
    configureSpecificationValidators(this.form);
  }

  removeDisque(index: number): void {
    this.disques.removeAt(index);
    configureSpecificationValidators(this.form);
  }

  onDisqueTypeChange(): void {
    configureSpecificationValidators(this.form);
  }

  get stockages(): FormArray {
    return this.form.get('stockage') as FormArray;
  }

  createStockageGroup(data?: Partial<StockageEntry>): FormGroup {
    return this.fb.group({
      typeStockage: [data?.typeStockage || data?.storageType || ''],
      customStorageType: [data?.customStorageType || data?.customType || ''],
      capaciteGo: [data?.capaciteGo ?? null],
      protocole: [data?.protocole || data?.protocol || ''],
      customProtocole: [data?.customProtocole || data?.customProtocol || ''],
      iops: [(data as any)?.iops ?? null],
      throughputMbps: [(data as any)?.throughputMbps ?? null],
      quotaGo: [(data as any)?.quotaGo ?? null],
      replication: [(data as any)?.replication || ''],
      encryption: [(data as any)?.encryption || ''],
    });
  }

  addStockage(): void {
    this.stockages.push(this.createStockageGroup());
    configureSpecificationValidators(this.form);
  }

  removeStockage(index: number): void {
    if (this.stockages.length <= 1) return;
    this.stockages.removeAt(index);
    configureSpecificationValidators(this.form);
  }

  onStockageChange(): void {
    configureSpecificationValidators(this.form);
  }

  retentionNumbers(): number[] {
    return retentionNombresDisponibles(this.form?.get('backup.retentionPeriode')?.value);
  }

  retentionMax(): number {
    return RETENTION_MAX_PAR_PERIODE[this.form?.get('backup.retentionPeriode')?.value] || 52;
  }

  isDiskRequired(): boolean {
    return this.form.get('sousCategorie')?.value === 'Création VM';
  }

  isStorageFieldVisible(field: SpecificationField, row: FormGroup): boolean {
    return this.showField('stockage', field.key) && (!field.visibleWhen || field.visibleWhen(row));
  }

  storageControl(row: FormGroup, key: string): any {
    return row.get(key);
  }

  storageFieldError(field: SpecificationField, row: FormGroup): string {
    return this.fieldError(field, this.storageControl(row, field.key));
  }

  optionLabel(option: { value: string; labelKey: string; enumMap?: string }): string {
    return option.enumMap ? option.value : option.labelKey;
  }

  trackByKey(_index: number, field: SpecificationField): string {
    return field.key;
  }

}

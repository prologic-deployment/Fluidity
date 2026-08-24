import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  sectionsPour,
  champVisible,
  DisqueServeur,
  StockageEntry,
  RETENTION_MAX_PAR_PERIODE,
} from '../models/changement.model';
import { fieldsForSection, STORAGE_FIELDS } from './specifications-form.config';
import { ipRangeValidator, validatorFor } from './specification.validators';

const AUTRE = 'Autre';

/**
 * Group-level validator for the canonical retention value. The two controls
 * are kept separate in the UI (number + unit) and serialized as "6 Mois".
 */
export function retentionCompleteValidator(control: AbstractControl): { retentionIncomplete: true } | null {
  const nombre = control.get('retentionNombre')?.value;
  const periode = control.get('retentionPeriode')?.value;
  const hasNumber = nombre !== null && nombre !== undefined && nombre !== '';
  const hasPeriod = periode !== null && periode !== undefined && periode !== '';
  return hasNumber === hasPeriod ? null : { retentionIncomplete: true };
}

/** Form groups shared by Demande, Changement and Ticket / Incident. */
export function buildSpecificationControls(fb: FormBuilder): Record<string, AbstractControl> {
  return {
    general: fb.group({
      ressourcesConcernees: [''],
      commentaire: [''],
    }),
    serveur: fb.group({
      os: [''],
      osPrecision: [''],
      hostname: [''],
      cpuCores: [null],
      ramGo: [null],
      environnementVm: [''],
      datacenter: [''],
      reseauVm: [''],
      configIp: [''],
      vmCible: [''],
      typeRessource: [''],
      valeurActuelle: [null],
      valeurDemandee: [null],
      vmSource: [''],
      nouveauNomVm: [''],
      destinationVm: [''],
      optionsPersonnalisation: [''],
      hoteSource: [''],
      hoteDestination: [''],
      typeMigration: [''],
      downtimeEstime: [null],
      impactReseau: [''],
      confirmationBackup: [''],
      confirmationSnapshot: [''],
      retentionDonnees: [null],
      motifDecommission: [''],
      nomSnapshot: [''],
      descriptionSnapshot: [''],
      retentionSnapshot: [null],
      expirationSnapshot: [''],
      disques: fb.array([]),
    }),
    reseau: fb.group({
      vlan: [null],
      vlanName: [''],
      descriptionVlan: [''],
      interfaceAssociee: [''],
      reseauCidr: [''],
      adresseIp: [''],
      masqueSousReseau: [''],
      passerelle: [''],
      dnsPrimaire: [''],
      dnsSecondaire: [''],
      routage: [''],
      zoneDns: [''],
      typeEnregistrement: [''],
      nomEnregistrement: [''],
      valeurActuelle: [''],
      nouvelleValeur: [''],
      ttl: [null],
      scopePool: [''],
      plageDebut: [''],
      plageFin: [''],
      plageAdresses: [''],
      reservation: [''],
      reseauDestination: [''],
      nextHop: [''],
      metrique: [null],
      protocoleRoutage: [''],
      typeVpn: [''],
      typeVpnPrecision: [''],
      protocoleVpn: [''],
      protocoleVpnPrecision: [''],
      reseauLocal: [''],
      reseauDistant: [''],
      chiffrementVpn: [''],
      chiffrementVpnPrecision: [''],
      methodeAuth: [''],
      methodeAuthPrecision: [''],
      peerGateway: [''],
      portVpn: [null],
      typeLb: [''],
      vip: [''],
      serveursBackend: [''],
      portsLb: [''],
      protocoleLb: [''],
      algorithmeLb: [''],
      healthCheck: [''],
      nomSwitch: [''],
      ipManagement: [''],
      interfacePort: [''],
      configRequise: [''],
      ssid: [''],
      modeSecurite: [''],
      authentificationWifi: [''],
      accessPoint: [''],
      typeProxy: [''],
      hostProxy: [''],
      portProxy: [null],
      protocoleProxy: [''],
      servicesCibles: [''],
      authProxy: [''],
    }),
    firewall: fb.group({
      reglesPareFeu: [''],
      ports: [''],
      nat: [''],
      zones: [''],
      politique: [''],
      vpn: [''],
      source: [''],
      destination: [''],
      protocole: [''],
      action: [''],
      direction: [''],
      dureeRegle: [null],
      justification: [''],
    }),
    backup: fb.group(
      {
        espaceBackupSupplementaireGo: [null],
        retentionNombre: [null],
        retentionPeriode: [''],
        frequenceSauvegarde: [''],
        destinationBackup: [''],
        compression: [''],
        chiffrement: [''],
        licencesNecessaires: [''],
        sourceBackup: [''],
        pointRestauration: [''],
        cibleRestore: [''],
        typeRestore: [''],
        perimetreDonnees: [''],
        retentionExistante: [''],
        typeReplication: [''],
        bandePassante: [null],
        rpo: [null],
        sourceArchive: [''],
        destinationArchive: [''],
        classeStockage: [''],
        exigencesRecuperation: [''],
        nomJobVeeam: [''],
        serveurVeeam: [''],
        typeBackupVeeam: [''],
        repository: [''],
        planification: [''],
        systemeCible: [''],
        perimetreBackup: [''],
        typeBackup: [''],
      },
      { validators: [retentionCompleteValidator] }
    ),
    stockage: fb.array([]),
    iaGpu: fb.group({
      typeGpu: [''],
      typeGpuPrecision: [''],
      nombreGpu: [null],
      vramGo: [null],
      framework: [''],
      versionCuda: [''],
      versionPilote: [''],
      serveurCible: [''],
      dureeEstimee: [null],
      versionPiloteActuelle: [''],
      versionPiloteDemandee: [''],
      compatibiliteCuda: [''],
      fenetreMaintenance: [''],
    }),
    securite: fb.group({
      perimetre: [''],
      niveauCriticite: [''],
      systemeCible: [''],
      environnementAudit: [''],
      typeAudit: [''],
      periodeAudit: [''],
      livrables: [''],
      typeCertificat: [''],
      formatCertificat: [''],
      nomCommun: [''],
      emetteurCa: [''],
      validite: [''],
      dateExpiration: [''],
      protocoleSecurite: [''],
      cibleInstallation: [''],
      renouvellementOuNouveau: [''],
    }),
  };
}

export function showSpecSection(form: FormGroup, section: string): boolean {
  if (section === 'general') return true;
  const cat = form?.get('categorie')?.value;
  if (!cat || cat === AUTRE) return false;
  const sous = form?.get('sousCategorie')?.value;
  return sectionsPour(cat, sous).includes(section);
}

export function showSpecField(form: FormGroup, section: string, champ: string): boolean {
  if (section === 'general') return true;
  return isSpecificationFieldVisible(form, section, champ);
}

/** Visibility combines the category/subcategory catalogue with dependencies. */
export function isSpecificationFieldVisible(form: FormGroup, section: string, champ: string): boolean {
  if (section === 'general') return true;
  if (!champVisible(form?.get('categorie')?.value, form?.get('sousCategorie')?.value, section, champ)) return false;
  const field = fieldsForSection(section).find((item) => item.key === champ);
  return !field?.visibleWhen || field.visibleWhen(form);
}

function emptyValue(control: AbstractControl): null | '' {
  return control.value === null || typeof control.value === 'number' ? null : '';
}

/** Clears stale values and validators as soon as a category/subcategory changes. */
export function resetSpecsIncompatibles(form: FormGroup): void {
  const sections = ['serveur', 'reseau', 'firewall', 'backup', 'iaGpu', 'securite'];
  for (const section of sections) {
    const group = form.get(section) as FormGroup | null;
    if (!group) continue;
    for (const key of Object.keys(group.controls)) {
      if (key === 'disques') {
        const disks = group.get(key) as FormArray;
        if (!isSpecificationFieldVisible(form, section, key)) disks.clear();
        continue;
      }
      const control = group.get(key);
      if (control && !isSpecificationFieldVisible(form, section, key) && !emptyValue(control)) {
        control.setValue(emptyValue(control), { emitEvent: false });
      }
    }
  }

  const stockages = form.get('stockage') as FormArray | null;
  if (stockages && !showSpecSection(form, 'stockage')) {
    stockages.clear();
  }
}

/**
 * Applies metadata validators to the visible controls only. A WeakSet keeps
 * the dependency subscription single and reusable in all three forms.
 */
const watchedForms = new WeakSet<FormGroup>();
const validationModes = new WeakMap<FormGroup, { legacy: boolean; requiredKeys: Set<string> }>();

export function watchSpecificationDependencies(form: FormGroup): void {
  if (watchedForms.has(form)) return;
  watchedForms.add(form);
  validationModes.set(form, { legacy: false, requiredKeys: new Set<string>() });
  form.valueChanges.subscribe(() => configureSpecificationValidators(form));
  configureSpecificationValidators(form);
}

/**
 * Existing tickets can contain partial legacy specifications. Keep their
 * values editable without forcing fields that did not exist when the record
 * was created; newly created requests keep the complete required rules.
 */
export function enableLegacySpecificationMode(form: FormGroup): void {
  const requiredKeys = new Set<string>();
  for (const section of ['serveur', 'reseau', 'firewall', 'backup', 'iaGpu', 'securite']) {
    const group = form.get(section) as FormGroup | null;
    if (!group) continue;
    for (const field of fieldsForSection(section)) {
      const control = group.get(field.key);
      if (control && isSpecificationFieldVisible(form, section, field.key) && field.required && control.value !== null && control.value !== '') {
        requiredKeys.add(`${section}.${field.key}`);
      }
    }
  }
  const stockages = form.get('stockage') as FormArray | null;
  stockages?.controls.forEach((control, index) => {
    const row = control as FormGroup;
    for (const field of STORAGE_FIELDS) {
      const child = row.get(field.key);
      if (child && child.value !== null && child.value !== '') requiredKeys.add(`stockage.${index}.${field.key}`);
    }
  });
  validationModes.set(form, { legacy: true, requiredKeys });
  configureSpecificationValidators(form);
}

function requiredInMode(form: FormGroup, key: string, required: boolean): boolean {
  const mode = validationModes.get(form);
  return required && (!mode?.legacy || mode.requiredKeys.has(key));
}

export function configureSpecificationValidators(form: FormGroup): void {
  const mode = validationModes.get(form);
  const groups = ['general', 'serveur', 'reseau', 'firewall', 'backup', 'iaGpu', 'securite'];
  for (const section of groups) {
    const group = form.get(section) as FormGroup | null;
    if (!group) continue;
    for (const field of fieldsForSection(section)) {
      const control = group.get(field.key);
      if (!control) continue;
      const visible = isSpecificationFieldVisible(form, section, field.key);
      if (!visible) {
        control.clearValidators();
        if (field.key !== 'commentaire' && control.value !== null && control.value !== '') {
          control.setValue(emptyValue(control), { emitEvent: false });
        }
        control.updateValueAndValidity({ emitEvent: false });
        continue;
      }

      const validators = (field.validators || []).map((kind) => validatorFor(kind));
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.max !== undefined) validators.push(Validators.max(field.max));

      const retentionField = section === 'backup' && (field.key === 'retentionNombre' || field.key === 'retentionPeriode');
      const portRequired = field.key === 'portVpn' && ['OpenVPN', 'TCP', 'UDP'].includes(form.get('reseau.protocoleVpn')?.value);
      const metadataRequired = field.required === true && (!field.requiredWhen || field.requiredWhen(form));
      const required = requiredInMode(form, `${section}.${field.key}`, metadataRequired || retentionField || portRequired);
      if (required) validators.push(Validators.required);
      if (field.key === 'retentionNombre') {
        const max = RETENTION_MAX_PAR_PERIODE[form.get('backup.retentionPeriode')?.value] || 52;
        validators.push(Validators.max(max));
      }
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  const reseau = form.get('reseau') as FormGroup | null;
  if (reseau) {
    const isDhcp = form.get('categorie')?.value === 'Réseau' && form.get('sousCategorie')?.value === 'DHCP';
    reseau.setValidators(isDhcp ? [ipRangeValidator('plageDebut', 'plageFin')] : []);
    reseau.updateValueAndValidity({ emitEvent: false });
  }

  const disks = form.get('serveur.disques') as FormArray | null;
  if (disks) {
    const diskFieldVisible = isSpecificationFieldVisible(form, 'serveur', 'disques');
    const creation = form.get('sousCategorie')?.value === 'Création VM';
    disks.setValidators(diskFieldVisible && creation && (!mode?.legacy || disks.length > 0) ? Validators.minLength(1) : []);
    disks.controls.forEach((control) => {
      const group = control as FormGroup;
      const rowHasValue = group.get('capaciteGo')?.value !== null && group.get('capaciteGo')?.value !== '' || group.get('type')?.value !== '';
      const diskRequired = diskFieldVisible && (!mode?.legacy || rowHasValue);
      group.get('capaciteGo')?.setValidators(diskRequired ? [Validators.required, Validators.min(1), Validators.max(1048576)] : []);
      group.get('type')?.setValidators(diskRequired ? [Validators.required] : []);
      const precision = group.get('typePrecision');
      const precisionRequired = diskRequired && group.get('type')?.value === AUTRE;
      precision?.setValidators(precisionRequired ? [Validators.required] : []);
      group.updateValueAndValidity({ emitEvent: false });
    });
    disks.updateValueAndValidity({ emitEvent: false });
  }

  const stockages = form.get('stockage') as FormArray | null;
  if (stockages) {
    const storageVisible = showSpecSection(form, 'stockage');
    stockages.controls.forEach((control) => {
      const row = control as FormGroup;
      for (const field of STORAGE_FIELDS) {
        const child = row.get(field.key);
        if (!child) continue;
        const visible = storageVisible && showSpecField(form, 'stockage', field.key) && (!field.visibleWhen || field.visibleWhen(row));
        if (!visible) {
          child.clearValidators();
          if (child.value !== null && child.value !== '') child.setValue(emptyValue(child), { emitEvent: false });
          child.updateValueAndValidity({ emitEvent: false });
          continue;
        }
        const validators = (field.validators || []).map((kind) => validatorFor(kind));
        if (field.min !== undefined) validators.push(Validators.min(field.min));
        if (field.max !== undefined) validators.push(Validators.max(field.max));
        const rowHasValue = child.value !== null && child.value !== '';
        if (requiredInMode(form, `stockage.${stockages.controls.indexOf(row)}.${field.key}`, field.required === true) && (!mode?.legacy || rowHasValue)) validators.push(Validators.required);
        child.setValidators(validators);
        child.updateValueAndValidity({ emitEvent: false });
      }
      row.updateValueAndValidity({ emitEvent: false });
    });
    stockages.updateValueAndValidity({ emitEvent: false });
  }
}

function clean(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj || {})) {
    const value = obj[key];
    if (value !== '' && value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

function cleanVisible(form: FormGroup, section: string, obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj || {})) {
    if (key === 'disques' || key === 'retentionNombre' || key === 'retentionPeriode') continue;
    if (!isSpecificationFieldVisible(form, section, key)) continue;
    const value = obj[key];
    if (value !== '' && value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/** Serializes only the active specification section and its visible fields. */
export function serializeSpecifications(form: FormGroup): Record<string, any> | undefined {
  const raw = form.value;
  const specifications: Record<string, any> = {};
  const sections = ['general', 'serveur', 'reseau', 'firewall', 'backup', 'stockage', 'iaGpu', 'securite'].filter((s) => showSpecSection(form, s));

  for (const section of sections) {
    if (section === 'serveur') {
      const serveur = cleanVisible(form, section, raw.serveur || {});
      const disques: DisqueServeur[] = (raw.serveur?.disques || [])
        .filter((disk: any) => disk?.capaciteGo !== null && disk?.capaciteGo !== undefined && disk?.capaciteGo !== '' && disk?.type)
        .map((disk: any) => {
          const value: DisqueServeur = { capaciteGo: Number(disk.capaciteGo), type: disk.type };
          if (disk.type === AUTRE && disk.typePrecision) value.typePrecision = disk.typePrecision;
          return value;
        });
      if (disques.length) serveur['disques'] = disques;
      if (Object.keys(serveur).length) specifications['serveur'] = serveur;
    } else if (section === 'backup') {
      const backup = cleanVisible(form, section, raw.backup || {});
      delete backup['retentionNombre'];
      delete backup['retentionPeriode'];
      if (raw.backup?.retentionNombre !== null && raw.backup?.retentionNombre !== undefined && raw.backup?.retentionNombre !== '' && raw.backup?.retentionPeriode) {
        backup['retentionSouhaitee'] = `${raw.backup.retentionNombre} ${raw.backup.retentionPeriode}`;
      }
      if (Object.keys(backup).length) specifications['backup'] = backup;
    } else if (section === 'stockage') {
      const stockages = (raw.stockage || [])
        .filter((entry: any) => entry?.typeStockage && entry?.protocole)
        .map((entry: any) => {
          const value: any = { typeStockage: entry.typeStockage, protocole: entry.protocole };
          for (const key of ['capaciteGo', 'iops', 'throughputMbps', 'quotaGo']) {
            if (entry[key] !== null && entry[key] !== undefined && entry[key] !== '') value[key] = Number(entry[key]);
          }
          if (entry.typeStockage === AUTRE && entry.customStorageType) value.customStorageType = entry.customStorageType;
          if (entry.protocole === AUTRE && entry.customProtocole) value.customProtocole = entry.customProtocole;
          for (const key of ['replication', 'encryption']) if (entry[key]) value[key] = entry[key];
          return value;
        });
      if (stockages.length) specifications['stockage'] = stockages;
    } else {
      const data = section === 'general' ? clean(raw[section] || {}) : cleanVisible(form, section, raw[section] || {});
      if (Object.keys(data).length) specifications[section] = data;
    }
  }
  return Object.keys(specifications).length ? specifications : undefined;
}

export function resolveCategorieSous(raw: { categorie: string; categorieAutre?: string; sousCategorie: string; sousCategorieAutre?: string }) {
  const categorie = raw.categorie === AUTRE ? raw.categorieAutre : raw.categorie;
  const sousCategorie = raw.sousCategorie === AUTRE || raw.categorie === AUTRE ? raw.sousCategorieAutre : raw.sousCategorie;
  return { categorie: categorie || '', sousCategorie: sousCategorie || '' };
}

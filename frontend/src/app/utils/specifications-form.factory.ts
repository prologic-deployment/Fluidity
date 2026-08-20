import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import {
  IPV4_PATTERN,
  sectionsPour,
  champVisible,
  champsPour,
  DisqueServeur,
  StockageEntry,
} from '../models/changement.model';

const AUTRE = 'Autre';

export function retentionCompleteValidator(control: AbstractControl): ValidationErrors | null {
  const nombre = control.get('retentionNombre')?.value;
  const periode = control.get('retentionPeriode')?.value;
  const a = nombre !== null && nombre !== undefined && nombre !== '';
  const b = periode !== null && periode !== undefined && periode !== '';
  return a === b ? null : { retentionIncomplete: true };
}

/** Form groups partagés Demande/Changement/Ticket. */
export function buildSpecificationControls(fb: FormBuilder): Record<string, AbstractControl> {
  return {
    general: fb.group({
      ressourcesConcernees: [''],
      commentaire: [''],
    }),
    serveur: fb.group({
      os: [''],
      hostname: [''],
      cpuCores: [null],
      ramGo: [null],
      environnementVm: [''],
      datacenter: [''],
      reseauVm: [''],
      configIp: [''],
      vmCible: [''],
      typeRessource: [''],
      valeurActuelle: [''],
      valeurDemandee: [''],
      vmSource: [''],
      nouveauNomVm: [''],
      destinationVm: [''],
      optionsPersonnalisation: [''],
      hoteSource: [''],
      hoteDestination: [''],
      typeMigration: [''],
      downtimeEstime: [''],
      impactReseau: [''],
      confirmationBackup: [''],
      confirmationSnapshot: [''],
      retentionDonnees: [''],
      motifDecommission: [''],
      nomSnapshot: [''],
      descriptionSnapshot: [''],
      retentionSnapshot: [''],
      expirationSnapshot: [''],
      disques: fb.array([]),
    }),
    reseau: fb.group({
      vlan: [''],
      vlanName: [''],
      descriptionVlan: [''],
      interfaceAssociee: [''],
      reseauCidr: [''],
      adresseIp: ['', Validators.pattern(IPV4_PATTERN)],
      masqueSousReseau: ['', Validators.pattern(IPV4_PATTERN)],
      passerelle: ['', Validators.pattern(IPV4_PATTERN)],
      dnsPrimaire: ['', Validators.pattern(IPV4_PATTERN)],
      dnsSecondaire: ['', Validators.pattern(IPV4_PATTERN)],
      routage: [''],
      zoneDns: [''],
      typeEnregistrement: [''],
      nomEnregistrement: [''],
      valeurActuelle: [''],
      nouvelleValeur: [''],
      ttl: [''],
      scopePool: [''],
      plageAdresses: [''],
      reservation: [''],
      reseauDestination: [''],
      nextHop: [''],
      metrique: [''],
      protocoleRoutage: [''],
      typeVpn: [''],
      reseauLocal: [''],
      reseauDistant: [''],
      chiffrementVpn: [''],
      methodeAuth: [''],
      peerGateway: [''],
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
      portProxy: [''],
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
      dureeRegle: [''],
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
        bandePassante: [''],
        rpo: [''],
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
      nombreGpu: [null],
      vramGo: [null],
      framework: [''],
      versionCuda: [''],
      versionPilote: [''],
      serveurCible: [''],
      dureeEstimee: [''],
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
      nomCommun: [''],
      emetteurCa: [''],
      validite: [''],
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
  return champVisible(form?.get('categorie')?.value, form?.get('sousCategorie')?.value, section, champ);
}

export function resetSpecsIncompatibles(form: FormGroup): void {
  const autorises = champsPour(form.get('categorie')?.value, form.get('sousCategorie')?.value);
  for (const section of ['serveur', 'reseau', 'firewall', 'backup', 'iaGpu', 'securite']) {
    const group = form.get(section) as FormGroup | null;
    if (!group) continue;
    const keep = new Set(autorises[section] || []);
    for (const key of Object.keys(group.controls)) {
      if (key === 'disques') {
        if (!keep.has('disques')) (group.get('disques') as FormArray).clear();
        continue;
      }
      if (!keep.has(key)) {
        const ctrl = group.get(key);
        if (ctrl && ctrl.value !== '' && ctrl.value !== null) {
          ctrl.setValue(
            key.includes('Go') || key.includes('Cores') || key === 'nombreGpu' || key === 'vramGo' ? null : '',
            { emitEvent: false }
          );
        }
      }
    }
  }
}

function clean(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === '' || v === null || v === undefined) continue;
    out[key] = v;
  }
  return out;
}

function cleanVisible(form: FormGroup, section: string, obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (key === 'disques' || key === 'retentionNombre' || key === 'retentionPeriode') continue;
    if (!showSpecField(form, section, key)) continue;
    const v = obj[key];
    if (v === '' || v === null || v === undefined) continue;
    out[key] = v;
  }
  return out;
}

/** Construit le payload specifications (même format que Changements). */
export function serializeSpecifications(form: FormGroup): Record<string, any> | undefined {
  const raw = form.value;
  const specifications: any = {};
  const sections = ['general', 'serveur', 'reseau', 'firewall', 'backup', 'stockage', 'iaGpu', 'securite'].filter((s) =>
    showSpecSection(form, s)
  );

  for (const section of sections) {
    if (section === 'serveur') {
      const serveur: any = cleanVisible(form, 'serveur', raw.serveur || {});
      delete serveur.disques;
      const disques: DisqueServeur[] = (raw.serveur?.disques || [])
        .filter((d: any) => d?.capaciteGo && d?.type)
        .map((d: any) => {
          const disque: DisqueServeur = { capaciteGo: Number(d.capaciteGo), type: d.type };
          if (d.type === AUTRE && d.typePrecision) disque.typePrecision = d.typePrecision;
          return disque;
        });
      if (disques.length) serveur.disques = disques;
      if (Object.keys(serveur).length) specifications.serveur = serveur;
    } else if (section === 'backup') {
      const backup: any = cleanVisible(form, 'backup', raw.backup || {});
      delete backup.retentionNombre;
      delete backup.retentionPeriode;
      if (raw.backup?.retentionNombre && raw.backup?.retentionPeriode) {
        backup.retentionSouhaitee = `${raw.backup.retentionNombre} ${raw.backup.retentionPeriode}`;
      }
      if (Object.keys(backup).length) specifications.backup = backup;
    } else if (section === 'stockage') {
      const stockages: StockageEntry[] = (raw.stockage || [])
        .filter((s: any) => s?.typeStockage && s?.protocole)
        .map((s: any) => {
          const entry: StockageEntry = { typeStockage: s.typeStockage, protocole: s.protocole };
          if (s.capaciteGo !== null && s.capaciteGo !== '' && s.capaciteGo !== undefined) {
            entry.capaciteGo = Number(s.capaciteGo);
          }
          if (s.typeStockage === AUTRE && s.customStorageType) entry.customStorageType = s.customStorageType;
          if (s.protocole === AUTRE && s.customProtocole) entry.customProtocole = s.customProtocole;
          return entry;
        });
      if (stockages.length) {
        specifications.stockage = stockages.map((e) => {
          const out: any = { ...e };
          if (out.typeStockage !== AUTRE) delete out.customStorageType;
          if (out.protocole !== AUTRE) delete out.customProtocole;
          if (!out.customStorageType) delete out.customStorageType;
          if (!out.customProtocole) delete out.customProtocole;
          if (out.capaciteGo === null || out.capaciteGo === undefined || out.capaciteGo === '') delete out.capaciteGo;
          return out;
        });
      }
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

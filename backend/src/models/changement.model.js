const mongoose = require('mongoose');
const { Schema } = mongoose;

const { CHANGEMENT_STATUTS } = require('../utils/workflow');

/**
 * TypeChangement: 'Standard' | 'Majeur' | 'Urgent'
 * StatutChangement (cycle de vie complet, §2.3.4) :
 *   'Soumis' -> 'En attente de validation' -> 'Approuvé' -> 'Planifié'
 *   -> 'En cours d'implémentation' -> 'Implémenté' -> 'En revue post-implémentation'
 *   -> 'Clôturé' (+ 'Rollback' et 'Rejeté')
 */

const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;

const DisqueSchema = new Schema(
  {
    _id: false,
    capaciteGo: { type: Number, required: true },
    type: { type: String, required: true }, // NVMe | SAS | SSD | HDD | SATA | Autre
    typePrecision: { type: String }, // précision libre quand type = 'Autre'
  },
  { _id: false }
);

const SpecificationsSchema = new Schema(
  {
    general: {
      ressourcesConcernees: { type: String },
      commentaire: { type: String },
    },
    serveur: {
      os: { type: String },
      osPrecision: { type: String },
      hostname: { type: String },
      cpuCores: { type: Number },
      ramGo: { type: Number },
      // Liste extensible de disques (taille + type).
      disques: { type: [DisqueSchema], default: undefined },
      // Champs dynamiques (création/clone/migration/snapshot/suppression…)
      environnementVm: { type: String },
      datacenter: { type: String },
      reseauVm: { type: String },
      configIp: { type: String },
      vmCible: { type: String },
      typeRessource: { type: String },
      valeurActuelle: { type: Schema.Types.Mixed },
      valeurDemandee: { type: Schema.Types.Mixed },
      vmSource: { type: String },
      nouveauNomVm: { type: String },
      destinationVm: { type: String },
      optionsPersonnalisation: { type: String },
      hoteSource: { type: String },
      hoteDestination: { type: String },
      typeMigration: { type: String },
      downtimeEstime: { type: Schema.Types.Mixed },
      impactReseau: { type: String },
      confirmationBackup: { type: String },
      confirmationSnapshot: { type: String },
      retentionDonnees: { type: Schema.Types.Mixed },
      motifDecommission: { type: String },
      nomSnapshot: { type: String },
      descriptionSnapshot: { type: String },
      retentionSnapshot: { type: Schema.Types.Mixed },
      expirationSnapshot: { type: String },
    },
    reseau: {
      vlan: { type: Schema.Types.Mixed },
      vlanName: { type: String },
      descriptionVlan: { type: String },
      interfaceAssociee: { type: String },
      reseauCidr: { type: String },
      adresseIp: { type: String, match: [IPV4_REGEX, 'Adresse IP invalide (format IPv4 attendu)'] },
      masqueSousReseau: { type: String, match: [IPV4_REGEX, 'Masque de sous-réseau invalide (format IPv4 attendu)'] },
      passerelle: { type: String, match: [IPV4_REGEX, 'Passerelle invalide (format IPv4 attendu)'] },
      dnsPrimaire: { type: String, match: [IPV4_REGEX, 'DNS primaire invalide (format IPv4 attendu)'] },
      dnsSecondaire: { type: String, match: [IPV4_REGEX, 'DNS secondaire invalide (format IPv4 attendu)'] },
      routage: { type: String },
      zoneDns: { type: String },
      typeEnregistrement: { type: String },
      nomEnregistrement: { type: String },
      valeurActuelle: { type: String },
      nouvelleValeur: { type: String },
      ttl: { type: Schema.Types.Mixed },
      scopePool: { type: String },
      plageDebut: { type: String },
      plageFin: { type: String },
      plageAdresses: { type: String },
      reservation: { type: String },
      reseauDestination: { type: String },
      nextHop: { type: String },
      metrique: { type: Schema.Types.Mixed },
      protocoleRoutage: { type: String },
      typeVpn: { type: String },
      typeVpnPrecision: { type: String },
      protocoleVpn: { type: String },
      protocoleVpnPrecision: { type: String },
      reseauLocal: { type: String },
      reseauDistant: { type: String },
      chiffrementVpn: { type: String },
      chiffrementVpnPrecision: { type: String },
      methodeAuth: { type: String },
      methodeAuthPrecision: { type: String },
      peerGateway: { type: String },
      portVpn: { type: Number },
      typeLb: { type: String },
      vip: { type: String },
      serveursBackend: { type: String },
      portsLb: { type: String },
      protocoleLb: { type: String },
      algorithmeLb: { type: String },
      healthCheck: { type: String },
      nomSwitch: { type: String },
      ipManagement: { type: String },
      interfacePort: { type: String },
      configRequise: { type: String },
      ssid: { type: String },
      modeSecurite: { type: String },
      authentificationWifi: { type: String },
      accessPoint: { type: String },
      typeProxy: { type: String },
      hostProxy: { type: String },
      portProxy: { type: Schema.Types.Mixed },
      protocoleProxy: { type: String },
      servicesCibles: { type: String },
      authProxy: { type: String },
    },
    firewall: {
      reglesPareFeu: { type: String },
      ports: { type: String },
      nat: { type: String },
      zones: { type: String },
      politique: { type: String },
      vpn: { type: String },
      source: { type: String },
      destination: { type: String },
      protocole: { type: String },
      action: { type: String },
      direction: { type: String },
      dureeRegle: { type: String },
      justification: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String },
      frequenceSauvegarde: { type: String },
      destinationBackup: { type: String },
      compression: { type: String }, // 'Oui' | 'Non'
      chiffrement: { type: String }, // 'Oui' | 'Non'
      licencesNecessaires: { type: String },
      sourceBackup: { type: String },
      pointRestauration: { type: String },
      cibleRestore: { type: String },
      typeRestore: { type: String },
      perimetreDonnees: { type: String },
      retentionExistante: { type: String },
      typeReplication: { type: String },
      bandePassante: { type: Schema.Types.Mixed },
      rpo: { type: Schema.Types.Mixed },
      sourceArchive: { type: String },
      destinationArchive: { type: String },
      classeStockage: { type: String },
      exigencesRecuperation: { type: String },
      nomJobVeeam: { type: String },
      serveurVeeam: { type: String },
      typeBackupVeeam: { type: String },
      repository: { type: String },
      planification: { type: String },
      systemeCible: { type: String },
      perimetreBackup: { type: String },
      typeBackup: { type: String },
    },
    // Stockage — supporte plusieurs configurations (FormArray). Mixed pour
    // compatibilité ascendante (objets uniques historiques vs tableau).
    stockage: { type: Schema.Types.Mixed },
    iaGpu: {
      typeGpu: { type: String },
      typeGpuPrecision: { type: String },
      nombreGpu: { type: Number },
      vramGo: { type: Number },
      framework: { type: String },
      versionCuda: { type: String },
      versionPilote: { type: String },
      serveurCible: { type: String },
      dureeEstimee: { type: Schema.Types.Mixed },
      versionPiloteActuelle: { type: String },
      versionPiloteDemandee: { type: String },
      compatibiliteCuda: { type: String },
      fenetreMaintenance: { type: String },
    },
    securite: {
      perimetre: { type: String },
      niveauCriticite: { type: String },
      systemeCible: { type: String },
      environnementAudit: { type: String },
      typeAudit: { type: String },
      periodeAudit: { type: String },
      livrables: { type: String },
      typeCertificat: { type: String },
      formatCertificat: { type: String },
      nomCommun: { type: String },
      emetteurCa: { type: String },
      validite: { type: String },
      dateExpiration: { type: String },
      protocoleSecurite: { type: String },
      cibleInstallation: { type: String },
      renouvellementOuNouveau: { type: String },
    },
  },
  { _id: false, strict: false }
);

const ChangementSchema = new Schema(
  {
    // Référence incrémentale unique (CHG-YYYY-NNNNN).
    reference: { type: String, required: true, trim: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    // Principal demandeur — Client (accès portail) ; 'Utilisateur' pour les
    // enregistrements historiques (populate dynamique via requesterModel).
    requester: { type: Schema.Types.ObjectId, refPath: 'requesterModel', required: true },
    requesterModel: { type: String, enum: ['Utilisateur', 'Client'], default: 'Client' },
    objetChangement: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    prerequisNecessaires: { type: String },
    planRetourArriere: { type: String, required: true },
    contrat: { type: Schema.Types.ObjectId, ref: 'Contrat', required: true },
    piecesJointes: [{ type: String }],
    typeChangement: {
      type: String,
      enum: ['Standard', 'Majeur', 'Urgent'],
      required: true,
    },
    statut: { type: String, enum: CHANGEMENT_STATUTS, default: 'Soumis' },
    specifications: { type: SpecificationsSchema, default: {} },
  },
  { timestamps: true }
);

ChangementSchema.index({ createdAt: -1 });
ChangementSchema.index({ clientId: 1 });
ChangementSchema.index({ requester: 1 });
ChangementSchema.index({ reference: 1 }, { unique: true });

/**
 * Normalise la section stockage pour compatibilité ascendante :
 * un objet unique (legacy) est exposé comme tableau côté API.
 */
function normalizeStockageForResponse(doc) {
  if (!doc || !doc.specifications) return doc;
  const spec = doc.specifications;
  if (spec.stockage && !Array.isArray(spec.stockage) && typeof spec.stockage === 'object') {
    const s = spec.stockage;
    const isEntry =
      s.typeStockage !== undefined ||
      s.protocole !== undefined ||
      s.storageType !== undefined ||
      s.protocol !== undefined ||
      s.capaciteGo !== undefined;
    if (isEntry) spec.stockage = [s];
  }
  return doc;
}

/**
 * Normalise le payload d'écriture (create/update) avant persistance :
 * - storageSpecifications → stockage
 * - objet unique → tableau
 * - nettoie les entrées vides et les customs inutiles
 */
function normalizeStockageForWrite(specifications) {
  if (!specifications) return specifications;
  if (specifications.storageSpecifications && !specifications.stockage) {
    specifications.stockage = specifications.storageSpecifications;
  }
  if (specifications.storageSpecifications) delete specifications.storageSpecifications;
  if (
    specifications.stockage &&
    !Array.isArray(specifications.stockage) &&
    typeof specifications.stockage === 'object'
  ) {
    const s = specifications.stockage;
    const isEntry =
      s.typeStockage !== undefined ||
      s.protocole !== undefined ||
      s.storageType !== undefined ||
      s.protocol !== undefined ||
      s.capaciteGo !== undefined;
    if (isEntry) specifications.stockage = [s];
  }
  if (Array.isArray(specifications.stockage)) {
    specifications.stockage = specifications.stockage
      .filter((e) => e && (e.typeStockage || e.storageType || e.protocole || e.protocol))
      .map((e) => {
        const type = e.typeStockage || e.storageType;
        const proto = e.protocole || e.protocol;
        const customType = e.customStorageType || e.customType;
        const customProto = e.customProtocole || e.customProtocol;
        const out = { typeStockage: type, protocole: proto };
        if (e.capaciteGo !== undefined && e.capaciteGo !== null && e.capaciteGo !== '') {
          out.capaciteGo = Number(e.capaciteGo);
        }
        if (type === 'Autre' && customType) out.customStorageType = customType;
        if (proto === 'Autre' && customProto) out.customProtocole = customProto;
        return out;
      });
  }
  return specifications;
}

ChangementSchema.pre('save', function (next) {
  if (this.specifications) {
    normalizeStockageForWrite(this.specifications);
  }
  next();
});

ChangementSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const spec = update?.specifications || update?.$set?.specifications;
  if (spec) normalizeStockageForWrite(spec);
  next();
});

ChangementSchema.post('find', function (docs) {
  if (Array.isArray(docs)) docs.forEach(normalizeStockageForResponse);
});
ChangementSchema.post('findOne', function (doc) {
  normalizeStockageForResponse(doc);
});
ChangementSchema.post('findOneAndUpdate', function (doc) {
  normalizeStockageForResponse(doc);
});
ChangementSchema.post('save', function (doc) {
  normalizeStockageForResponse(doc);
});

const Changement = mongoose.model('Changement', ChangementSchema);

module.exports = {
  Changement,
  normalizeStockageForResponse,
  normalizeStockageForWrite,
};

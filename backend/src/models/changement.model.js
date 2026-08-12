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

// Schéma d'une entrée de stockage — utilisé en tableau pour supporter
// plusieurs configurations (FormArray côté frontend). Les champs custom
// ne sont renseignés que lorsque la valeur est "Autre".
const StockageEntrySchema = new Schema(
  {
    typeStockage: { type: String },
    customStorageType: { type: String },
    capaciteGo: { type: Number },
    protocole: { type: String },
    customProtocole: { type: String },
    // Aliases anglais pour compatibilité payload (storageSpecifications)
    storageType: { type: String },
    customType: { type: String },
    protocol: { type: String },
    customProtocol: { type: String },
  },
  { _id: false, strict: false }
);

const SpecificationsSchema = new Schema(
  {
    general: {
      ressourcesConcernees: { type: String },
      environnement: { type: String },
      commentaire: { type: String },
    },
    serveur: {
      os: { type: String },
      hostname: { type: String },
      cpuCores: { type: Number },
      ramGo: { type: Number },
      // Disques dynamiques : paires [capacité Go] + [type] (NVMe/SAS/SSD/HDD/SATA/Autre)
      disques: [
        new Schema(
          {
            capaciteGo: { type: Number, required: true },
            type: { type: String, required: true },
            typePrecision: { type: String }, // précision libre quand type = 'Autre'
          },
          { _id: false }
        ),
      ],
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String, match: [IPV4_REGEX, 'Adresse IP invalide (format IPv4 attendu)'] },
      masqueSousReseau: { type: String, match: [IPV4_REGEX, 'Masque de sous-réseau invalide (format IPv4 attendu)'] },
      passerelle: { type: String, match: [IPV4_REGEX, 'Passerelle invalide (format IPv4 attendu)'] },
      dnsPrimaire: { type: String, match: [IPV4_REGEX, 'DNS primaire invalide (format IPv4 attendu)'] },
      dnsSecondaire: { type: String, match: [IPV4_REGEX, 'DNS secondaire invalide (format IPv4 attendu)'] },
      routage: { type: String }, // Statique, OSPF, BGP...
    },
    // Section dédiée pare-feu / VPN (combinaisons Réseau+VPN et
    // Sécurité+Firewall — voir SECTIONS_SPECIFICATIONS côté frontend)
    firewall: {
      reglesPareFeu: { type: String }, // une règle par ligne
      ports: { type: String },
      nat: { type: String },
      zones: { type: String },
      politique: { type: String },
      vpn: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String }, // « <nombre> <période> » validé par Zod (plages par période)
      frequenceSauvegarde: { type: String },
      destinationBackup: { type: String },
      compression: { type: String }, // 'Oui' | 'Non'
      chiffrement: { type: String }, // 'Oui' | 'Non'
      licencesNecessaires: { type: String },
    },
    // Sections additionnelles, affichées côté formulaire selon la catégorie
    // sélectionnée (miroir du schéma Zod et des FormGroups Angular).
    baseDeDonnees: {
      moteur: { type: String }, // SQL Server, PostgreSQL, MySQL, Oracle, MongoDB...
      version: { type: String },
      tailleGo: { type: Number },
    },
    // Stockage — supporte plusieurs configurations (FormArray). Stocké en
    // tableau d'objets { typeStockage, customStorageType, capaciteGo, protocole, customProtocole }.
    // Mixed pour compatibilité ascendante : les enregistrements historiques
    // contiennent un objet unique { typeStockage, capaciteGo, protocole }.
    // Les nouveaux enregistrements sont toujours un tableau.
    stockage: { type: Schema.Types.Mixed },
    portailWeb: {
      domaine: { type: String },
      sslRequis: { type: String }, // 'Oui' | 'Non'
      technologie: { type: String },
    },
    conteneurs: {
      plateforme: { type: String }, // Docker, Kubernetes...
      nombreReplicas: { type: Number },
      cpuAlloue: { type: String },
      memoireAllouee: { type: String },
    },
    iaGpu: {
      typeGpu: { type: String }, // NVIDIA A100, H100...
      nombreGpu: { type: Number },
      vramGo: { type: Number }, // mémoire vidéo par GPU
      framework: { type: String }, // PyTorch, TensorFlow, ONNX, Hugging Face, CUDA...
      versionCuda: { type: String },
      versionPilote: { type: String },
    },
    securite: {
      perimetre: { type: String },
      niveauCriticite: { type: String }, // Standard, Élevé, Critique...
    },
    // Alias anglais pour compatibilité (storageSpecifications)
    storageSpecifications: { type: Schema.Types.Mixed },
  },
  { _id: false, strict: false }
);

const ChangementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // Compte utilisateur (CLIENT) qui a soumis le changement — normalisation ObjectId
    // Principal demandeur — Client (accès portail) ; 'Utilisateur' pour les
    // enregistrements historiques (populate dynamique via requesterModel).
    requester: { type: Schema.Types.ObjectId, refPath: 'requesterModel', required: true },
    requesterModel: {
      type: String,
      enum: ['Utilisateur', 'Client'],
      default: 'Client',
    },
    objetChangement: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    // NB : la « fenêtre d'intervention souhaitée » n'est plus collectée (formulaire simplifié).
    // Les documents existants conservent leur champ fenetreIntervention historique s'il existe.
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

ChangementSchema.index({ tenantId: 1, createdAt: -1 });
ChangementSchema.index({ tenantId: 1, requester: 1 });

/**
 * Normalise la section stockage pour compatibilité ascendante :
 * - Si storageSpecifications (alias anglais) est présent, le migre vers stockage.
 * - Si stockage est un objet unique (legacy), l'expose comme tableau côté API
 *   pour que le frontend reçoive toujours un tableau cohérent.
 * - Nettoie les customs inutiles (expose seulement les champs pertinents).
 */
function normalizeStockageForResponse(doc) {
  if (!doc || !doc.specifications) return doc;
  const spec = doc.specifications;
  // Migrer l'alias anglais s'il existe et que stockage est vide
  if (spec.storageSpecifications && !spec.stockage) {
    spec.stockage = spec.storageSpecifications;
  }
  // Supprimer l'alias pour ne pas exposer de doublon
  if (spec.storageSpecifications) {
    // Mongoose Mixed : delete + markModified si nécessaire
    if (spec.toObject) {
      // Document
      spec.storageSpecifications = undefined;
    } else {
      delete spec.storageSpecifications;
    }
  }
  // Legacy : objet unique → tableau à un élément (exposition API uniquement)
  if (spec.stockage && !Array.isArray(spec.stockage) && typeof spec.stockage === 'object') {
    const s = spec.stockage;
    const isEntry =
      s.typeStockage !== undefined ||
      s.protocole !== undefined ||
      s.storageType !== undefined ||
      s.protocol !== undefined ||
      s.capaciteGo !== undefined;
    if (isEntry) {
      spec.stockage = [s];
    }
  }
  // Nettoyer l'alias résiduel si présent après migration
  if (spec.storageSpecifications) {
    delete spec.storageSpecifications;
  }
  return doc;
}

/**
 * Normalise le payload d'écriture (create/update) avant persistance :
 * - storageSpecifications → stockage
 * - objet unique → tableau
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
  // Nettoyer chaque entrée : retirer les customs vides si non "Autre"
  if (Array.isArray(specifications.stockage)) {
    specifications.stockage = specifications.stockage
      .filter((e) => e && (e.typeStockage || e.storageType || e.protocole || e.protocol))
      .map((e) => {
        const type = e.typeStockage || e.storageType;
        const proto = e.protocole || e.protocol;
        const customType = e.customStorageType || e.customType;
        const customProto = e.customProtocole || e.customProtocol;
        const out = {
          typeStockage: type,
          protocole: proto,
        };
        if (e.capaciteGo !== undefined && e.capaciteGo !== null && e.capaciteGo !== '') out.capaciteGo = Number(e.capaciteGo);
        if (type === 'Autre' && customType) out.customStorageType = customType;
        if (proto === 'Autre' && customProto) out.customProtocole = customProto;
        return out;
      });
  }
  return specifications;
}

// Pré-traitement à l'écriture : normalise stockage avant persistance
ChangementSchema.pre('save', function (next) {
  if (this.specifications) {
    normalizeStockageForWrite(this.specifications);
  }
  next();
});

ChangementSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  // Gère à la fois { $set: { specifications } } et { specifications }
  const spec = update?.specifications || update?.$set?.specifications;
  if (spec) {
    normalizeStockageForWrite(spec);
  }
  // Cas où specifications.stockage est directement dans $set
  const stockageSet = update?.$set?.['specifications.stockage'] || update?.['specifications.stockage'];
  if (stockageSet && !Array.isArray(stockageSet) && typeof stockageSet === 'object') {
    const isEntry = stockageSet.typeStockage || stockageSet.protocole || stockageSet.storageType || stockageSet.protocol;
    if (isEntry) {
      if (update.$set) update.$set['specifications.stockage'] = [stockageSet];
      else update['specifications.stockage'] = [stockageSet];
    }
  }
  next();
});

// Hook post-find pour normaliser la sortie (lecture)
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

module.exports = { Changement, StockageEntrySchema, normalizeStockageForResponse, normalizeStockageForWrite };

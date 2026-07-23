const mongoose = require('mongoose');
const { Schema } = mongoose;

const { CHANGEMENT_STATUTS } = require('../utils/workflow');

/**
 * TypeChangement: 'Normal' | 'Majeur' | 'Urgent'
 * StatutChangement (cycle de vie complet, §2.3.4) :
 *   'Soumis' -> 'En attente de validation' -> 'Approuvé' -> 'Planifié'
 *   -> 'En cours d'implémentation' -> 'Implémenté' -> 'En revue post-implémentation'
 *   -> 'Clôturé' (+ 'Rollback' et 'Rejeté')
 */

const DISK_TYPES = ['NVMe', 'SAS', 'SSD', 'SATA'];
const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;

const SpecificationsSchema = new Schema(
  {
    general: {
      ressourcesConcernees: { type: String },
      environnement: { type: String },
      commentaire: { type: String },
    },
    serveur: {
      os: { type: String },
      cpuCores: { type: Number },
      ramGo: { type: Number },
      // Liste extensible de disques (taille + type), remplace les anciens
      // champs fixes disqueNvmeGo / disqueSasGo pour supporter tout type de disque.
      disques: [
        {
          _id: false,
          tailleGo: { type: Number },
          type: { type: String, enum: DISK_TYPES },
        },
      ],
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String, match: [IPV4_REGEX, 'Adresse IP invalide (format IPv4 attendu)'] },
      masqueSousReseau: { type: String, match: [IPV4_REGEX, 'Masque de sous-réseau invalide (format IPv4 attendu)'] },
      passerelle: { type: String, match: [IPV4_REGEX, 'Passerelle invalide (format IPv4 attendu)'] },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String },
      licencesNecessaires: { type: String },
    },
    // Sections additionnelles, affichées côté formulaire selon la catégorie sélectionnée
    database: {
      moteur: { type: String }, // SQL Server, PostgreSQL, MySQL, Oracle, MongoDB...
      version: { type: String },
      instance: { type: String },
      nomBaseDeDonnees: { type: String },
    },
    conteneurs: {
      nomConteneur: { type: String },
      image: { type: String },
      registry: { type: String },
      namespace: { type: String },
    },
    stockage: {
      capaciteGo: { type: Number },
      pointMontage: { type: String },
      systemeFichiers: { type: String }, // NFS, SMB, ext4, XFS...
    },
    securite: {
      regleFirewall: { type: String },
      niveauSecurite: { type: String }, // Standard, Élevé, Critique...
      certificat: { type: String },
    },
    iaGpu: {
      modeleGpu: { type: String },
      versionCuda: { type: String },
      vramGo: { type: Number },
      nombreGpu: { type: Number },
    },
  },
  { _id: false }
);

const ChangementSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    objetChangement: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    fenetreIntervention: { type: Date, required: true },
    prerequisNecessaires: { type: String },
    planRetourArriere: { type: String, required: true },
    contrat: { type: String, required: true },
    piecesJointes: [{ type: String }],
    typeChangement: {
      type: String,
      enum: ['Normal', 'Majeur', 'Urgent'],
      required: true,
    },
    statut: { type: String, enum: CHANGEMENT_STATUTS, default: 'Soumis' },
    specifications: { type: SpecificationsSchema, default: {} },
  },
  { timestamps: true }
);

ChangementSchema.index({ tenantId: 1, createdAt: -1 });

const Changement = mongoose.model('Changement', ChangementSchema);

module.exports = { Changement };

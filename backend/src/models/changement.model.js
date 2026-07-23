const mongoose = require('mongoose');
const { Schema } = mongoose;

const { CHANGEMENT_STATUTS } = require('../utils/workflow');

const DiskSchema = new Schema(
  {
    taille: { type: Number },
    type: { type: String },
    typeAutre: { type: String },
  },
  { _id: false }
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
      cpuCores: { type: Number },
      ramGo: { type: Number },
      disques: [DiskSchema],
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String },
      masqueSousReseau: { type: String },
      passerelle: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionNombre: { type: Number },
      retentionPeriode: { type: String },
      licencesNecessaires: { type: String },
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
    serviceEnvironnementAutre: { type: String },
    categorie: { type: String, required: true },
    categorieAutre: { type: String },
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

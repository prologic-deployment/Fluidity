const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * TypeChangement: 'Normal' | 'Majeur' | 'Urgent'
 * StatutChangement: 'Soumis' | 'En revue' | 'Approuvé' | 'Rejeté' | 'En cours' | 'Clôturé'
 */

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
      disqueNvmeGo: { type: Number },
      disqueSasGo: { type: Number },
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String },
      masqueSousReseau: { type: String },
      passerelle: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String },
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
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    fenetreIntervention: { type: Date, required: true },
    prerequisNecessaires: { type: String },
    planRetourArriere: { type: String, required: true },
    typeChangement: {
      type: String,
      enum: ['Normal', 'Majeur', 'Urgent'],
      required: true,
    },
    statut: { type: String, default: 'Soumis' },
    specifications: { type: SpecificationsSchema, default: {} },
  },
  { timestamps: true }
);

ChangementSchema.index({ tenantId: 1, createdAt: -1 });

const Changement = mongoose.model('Changement', ChangementSchema);

module.exports = { Changement };

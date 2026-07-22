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

/**
 * Sections de spécifications affichées dynamiquement selon la catégorie :
 *   general     -> toujours visible
 *   serveur     -> VM / Infrastructure
 *   reseau      -> Réseau
 *   backup      -> Sauvegarde
 *   baseDeDonnees / stockage / portailWeb / conteneurs / iaGpu / securite
 *               -> catégories éponymes (sections ajoutées)
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
      adresseIp: { type: String },
      masqueSousReseau: { type: String },
      passerelle: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String },
      licencesNecessaires: { type: String },
    },
    baseDeDonnees: {
      moteur: { type: String },
      version: { type: String },
      tailleGo: { type: Number },
    },
    stockage: {
      typeStockage: { type: String },
      capaciteGo: { type: Number },
      protocole: { type: String },
    },
    portailWeb: {
      domaine: { type: String },
      sslRequis: { type: String }, // 'Oui' | 'Non'
      technologie: { type: String },
    },
    conteneurs: {
      plateforme: { type: String },
      nombreReplicas: { type: Number },
      cpuAlloue: { type: String },
      memoireAllouee: { type: String },
    },
    iaGpu: {
      typeGpu: { type: String },
      nombreGpu: { type: Number },
      framework: { type: String },
    },
    securite: {
      perimetre: { type: String },
      niveauCriticite: { type: String },
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

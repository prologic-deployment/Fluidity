const mongoose = require('mongoose');
const { Schema } = mongoose;

const { DEMANDE_STATUTS } = require('../utils/workflow');

/**
 * PrioriteDemande: 'Standard' | 'Élevée' | 'Urgente'
 * StatutDemande (cycle de vie complet, §2.2.2) :
 *   'Ouverte' -> 'En cours d'analyse' -> 'En attente de validation'
 *   -> 'En cours de réalisation' -> 'Réalisée' -> 'Clôturée'
 *   (+ 'En attente client' et 'Rejetée')
 */

const DemandeSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    objet: { type: String, required: true },
    typeDemande: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    prioriteSouhaitee: {
      type: String,
      enum: ['Standard', 'Élevée', 'Urgente'],
      required: true,
    },
    dateSouhaiteeRealisation: { type: Date },
    informationsComplementaires: { type: String },
    contrat: { type: String, required: true },
    piecesJointes: [{ type: String }],
    statut: { type: String, enum: DEMANDE_STATUTS, default: 'Ouverte' },
  },
  { timestamps: true }
);

// Index pour isoler les requêtes par tenant
DemandeSchema.index({ tenantId: 1, createdAt: -1 });

const Demande = mongoose.model('Demande', DemandeSchema);

module.exports = { Demande };

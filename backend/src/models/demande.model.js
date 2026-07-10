const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * PrioriteDemande: 'Standard' | 'Élevée' | 'Urgente'
 * StatutDemande: 'Ouverte' | 'En cours d'analyse' | 'En cours de traitement'
 *                | 'Résolue' | 'Fermée' | 'Rejetée'
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
    statut: { type: String, default: 'Ouverte' },
  },
  { timestamps: true }
);

// Index pour isoler les requêtes par tenant
DemandeSchema.index({ tenantId: 1, createdAt: -1 });

const Demande = mongoose.model('Demande', DemandeSchema);

module.exports = { Demande };

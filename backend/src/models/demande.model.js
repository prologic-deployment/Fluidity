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
    // Client (entité commerciale) qui porte la demande — ObjectId.
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    // Compte utilisateur (CLIENT) qui a soumis la demande.
    requester: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
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
    contrat: { type: Schema.Types.ObjectId, ref: 'Contrat', required: true },
    piecesJointes: [{ type: String }],
    statut: { type: String, enum: DEMANDE_STATUTS, default: 'Ouverte' },
  },
  { timestamps: true }
);

DemandeSchema.index({ createdAt: -1 });
DemandeSchema.index({ clientId: 1 });
DemandeSchema.index({ requester: 1 });

const Demande = mongoose.model('Demande', DemandeSchema);

module.exports = { Demande };

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
    // Référence incrémentale unique (DEM-YYYY-NNNNN).
    reference: { type: String, required: true, trim: true, unique: true },
    // Client (entité commerciale) qui porte la demande — ObjectId.
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    // Principal qui a soumis la demande — le Client (accès portail) depuis la
    // refonte d'architecture ; 'Utilisateur' ne subsiste que pour les
    // enregistrements historiques (populate dynamique via requesterModel).
    requester: { type: Schema.Types.ObjectId, refPath: 'requesterModel', required: true },
    requesterModel: { type: String, enum: ['Utilisateur', 'Client'], default: 'Client' },
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
    // Mixed keeps old records readable while the shared frontend validates new values.
    specifications: { type: Schema.Types.Mixed, default: {} },
    statut: { type: String, enum: DEMANDE_STATUTS, default: 'Ouverte' },
  },
  { timestamps: true }
);

DemandeSchema.index({ createdAt: -1 });
DemandeSchema.index({ clientId: 1 });
DemandeSchema.index({ requester: 1 });
DemandeSchema.index({ reference: 1 }, { unique: true });

const Demande = mongoose.model('Demande', DemandeSchema);

module.exports = { Demande };

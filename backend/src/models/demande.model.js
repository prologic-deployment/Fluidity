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
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // Principal qui a soumis la demande — le Client (accès portail) depuis la
    // refonte d'architecture ; 'Utilisateur' ne subsiste que pour les
    // enregistrements historiques (voir requesterModel / populate dynamique).
    requester: { type: Schema.Types.ObjectId, refPath: 'requesterModel', required: true },
    requesterModel: {
      type: String,
      enum: ['Utilisateur', 'Client'],
      default: 'Client',
    },
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

// Index pour isoler les requêtes par tenant
DemandeSchema.index({ tenantId: 1, createdAt: -1 });
DemandeSchema.index({ tenantId: 1, requester: 1 });

// DB-002 (audit) : suppression LOGIQUE — la suppression admin pose deletedAt,
// la fiche disparaît de toutes les lectures mais reste traçable en base.
const { activerSuppressionLogique } = require('../utils/soft-delete.util');
activerSuppressionLogique(DemandeSchema);

const Demande = mongoose.model('Demande', DemandeSchema);

module.exports = { Demande };

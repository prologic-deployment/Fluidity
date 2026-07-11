const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * StatutContrat: 'Actif' | 'Expiré' | 'Suspendu'
 *
 * Un Contrat représente un contrat client-Fluidity. Il est créé par un
 * ADMIN et sert de référence pour les Demandes et les Changements
 * (listes déroulantes "Contrat" alimentées par ce modèle).
 */
const ContratSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    reference: { type: String, required: true, trim: true },
    intitule: { type: String, required: true },
    typeContrat: { type: String, default: 'Support' },
    statut: {
      type: String,
      enum: ['Actif', 'Expiré', 'Suspendu'],
      default: 'Actif',
    },
    dateDebut: { type: Date, required: true },
    dateFin: { type: Date },
    description: { type: String },
  },
  { timestamps: true }
);

// Une référence de contrat est unique par tenant
ContratSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
ContratSchema.index({ tenantId: 1, clientId: 1 });

const Contrat = mongoose.model('Contrat', ContratSchema);

module.exports = { Contrat };

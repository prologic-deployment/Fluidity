const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * StatutContrat: 'Actif' | 'Expiré' | 'Suspendu'
 *
 * Un Contrat représente un contrat client-Fluidity. Il est créé par un
 * ADMIN et sert de référence pour les Demandes, Changements et Tickets
 * (listes déroulantes "Contrat" alimentées par ce modèle).
 */
const ContratSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    reference: { type: String, required: true, trim: true, unique: true },
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

ContratSchema.index({ clientId: 1 });

const Contrat = mongoose.model('Contrat', ContratSchema);

module.exports = { Contrat };

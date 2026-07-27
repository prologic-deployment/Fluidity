const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * StatutClient: 'Actif' | 'Inactif'
 *
 * Un Client représente un compte/entreprise cliente D'UN TENANT (jamais
 * de la plateforme), géré par le Tenant Admin. Les Contrats y font
 * référence via `Contrat.clientId` (ObjectId) et l'utilisateur CLIENT qui
 * se connecte en son nom partage le même `email` au sein du tenant.
 */
const ClientSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    nom: { type: String, required: true }, // raison sociale / nom du client
    telephone: { type: String },
    adresse: { type: String },
    statut: {
      type: String,
      enum: ['Actif', 'Inactif'],
      default: 'Actif',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

// Un email de client est unique par tenant
ClientSchema.index({ tenantId: 1, email: 1 }, { unique: true });

const Client = mongoose.model('Client', ClientSchema);

module.exports = { Client };

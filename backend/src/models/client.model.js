const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * StatutClient: 'Actif' | 'Inactif'
 *
 * Un Client représente un compte/entreprise cliente de Fluidity, créé par
 * un ADMIN. Son `email` est la clé de rattachement utilisée par les
 * Contrats (`Contrat.clientId`) ainsi que par les Demandes/Changements
 * soumis par l'utilisateur CLIENT correspondant (`req.userEmail`) — un
 * Client et le compte Utilisateur qui se connecte en son nom partagent
 * donc le même email au sein d'un tenant.
 */
const ClientSchema = new Schema(
  {
    tenantId: { type: String, required: true },
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

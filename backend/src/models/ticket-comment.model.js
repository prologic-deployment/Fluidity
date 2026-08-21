const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketCommentSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    visibilite: { type: String, enum: ['public', 'interne'], required: true },
    corps: { type: String, required: true, trim: true, maxlength: 8000 },
    // Auteur : Utilisateur interne OU Client portail (populate dynamique).
    auteur: { type: Schema.Types.ObjectId, refPath: 'auteurModel', required: true },
    auteurModel: { type: String, enum: ['Utilisateur', 'Client'], required: true },
    piecesJointes: [{ type: String }],
  },
  { timestamps: true }
);

TicketCommentSchema.index({ ticketId: 1, createdAt: 1 });

const TicketComment = mongoose.model('TicketComment', TicketCommentSchema);
module.exports = { TicketComment };

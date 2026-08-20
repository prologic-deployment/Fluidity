const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketActivitySchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    action: { type: String, required: true },
    visibilite: { type: String, enum: ['public', 'interne'], default: 'public' },
    acteur: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
    acteurEmail: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TicketActivitySchema.index({ ticketId: 1, createdAt: 1 });

const TicketActivity = mongoose.model('TicketActivity', TicketActivitySchema);
module.exports = { TicketActivity };

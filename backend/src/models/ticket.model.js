const mongoose = require('mongoose');
const { Schema } = mongoose;
const { TICKET_STATUTS, TICKET_TYPES } = require('../utils/workflow');
const { PRIORITES, IMPACTS, URGENCES } = require('../utils/ticket-priority');

const DiagnosticSchema = new Schema(
  {
    source: String,
    destination: String,
    protocole: String,
    port: String,
    direction: String,
    comportement: String,
    nomVm: String,
    environnement: String,
    hote: String,
    ip: String,
    systemeStockage: String,
    volume: String,
    capacite: String,
    systemeAffecte: String,
    evenementSecurite: String,
    heureDetection: String,
  },
  { _id: false, strict: false }
);

const TicketSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    contrat: { type: Schema.Types.ObjectId, ref: 'Contrat', required: true },
    createdBy: { type: Schema.Types.ObjectId, refPath: 'createdByModel', required: true },
    createdByModel: { type: String, enum: ['Utilisateur', 'Client'], default: 'Client' },
    reference: { type: String, required: true, trim: true },
    type: { type: String, enum: TICKET_TYPES, default: 'Incident', required: true },
    objet: { type: String, required: true, trim: true, maxlength: 200 },
    descriptionDetaillee: { type: String, required: true },
    openedAt: { type: Date, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    impact: { type: String, enum: IMPACTS, required: true },
    urgence: { type: String, enum: URGENCES, required: true },
    priorite: { type: String, enum: PRIORITES, required: true },
    statut: { type: String, enum: TICKET_STATUTS, default: 'Nouveau' },
    assignedTeam: { type: String, default: '' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    piecesJointes: [{ type: String }],
    diagnostic: { type: DiagnosticSchema, default: {} },
    specifications: { type: Schema.Types.Mixed, default: {} },
    attenteMotif: { type: String },
    attenteDepuis: { type: Date },
    sla: {
      reponseHeures: { type: Number },
      resolutionHeures: { type: Number },
      reponseDueAt: { type: Date },
      resolutionDueAt: { type: Date },
      respondedAt: { type: Date },
      pausedAt: { type: Date },
      pausedMs: { type: Number, default: 0 },
      breached: { type: Boolean, default: false },
    },
    resolution: {
      resume: { type: String },
      actionCorrective: { type: String },
      workaround: { type: String },
      resolvedAt: { type: Date },
      resolvedBy: { type: Schema.Types.ObjectId, refPath: 'resolution.resolvedByModel' },
      resolvedByModel: { type: String, enum: ['Utilisateur', 'Client'] },
      confirmationClient: { type: Boolean, default: false },
      confirmationAt: { type: Date },
      closedAt: { type: Date },
      closedBy: { type: Schema.Types.ObjectId },
      closedReason: { type: String },
    },
  },
  { timestamps: true }
);

TicketSchema.index({ tenantId: 1, createdAt: -1 });
TicketSchema.index({ tenantId: 1, clientId: 1 });
TicketSchema.index({ tenantId: 1, statut: 1 });
TicketSchema.index({ tenantId: 1, priorite: 1 });
TicketSchema.index({ tenantId: 1, assignedTo: 1 });
TicketSchema.index({ tenantId: 1, assignedTeam: 1 });
TicketSchema.index({ tenantId: 1, contrat: 1 });
TicketSchema.index({ tenantId: 1, categorie: 1, sousCategorie: 1 });
TicketSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
TicketSchema.index({ tenantId: 1, openedAt: -1 });

const TicketSequenceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0 },
});
TicketSequenceSchema.index({ tenantId: 1, year: 1 }, { unique: true });

const TicketSequence = mongoose.model('TicketSequence', TicketSequenceSchema);

async function nextTicketReference(tenantId) {
  const year = new Date().getFullYear();
  const doc = await TicketSequence.findOneAndUpdate(
    { tenantId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INC-${year}-${String(doc.seq).padStart(4, '0')}`;
}

const Ticket = mongoose.model('Ticket', TicketSchema);

module.exports = { Ticket, TicketSequence, nextTicketReference };

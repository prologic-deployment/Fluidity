const { z } = require('zod');
const { objectId } = require('./common');
const { IMPACTS, URGENCES } = require('../utils/ticket-priority');

const diagnosticSchema = z
  .object({
    source: z.string().optional(),
    destination: z.string().optional(),
    protocole: z.string().optional(),
    port: z.string().optional(),
    direction: z.string().optional(),
    comportement: z.string().optional(),
    nomVm: z.string().optional(),
    environnement: z.string().optional(),
    hote: z.string().optional(),
    ip: z.string().optional(),
    systemeStockage: z.string().optional(),
    volume: z.string().optional(),
    capacite: z.string().optional(),
    systemeAffecte: z.string().optional(),
    evenementSecurite: z.string().optional(),
    heureDetection: z.string().optional(),
  })
  .passthrough()
  .optional();

const createTicketSchema = z.object({
  objet: z.string().trim().min(3, 'Objet requis').max(200),
  descriptionDetaillee: z.string().trim().min(10, 'Description trop courte'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  impact: z.enum(IMPACTS),
  urgence: z.enum(URGENCES),
  contrat: objectId('Contrat (ObjectId) requis'),
  piecesJointes: z.array(z.string()).optional(),
  diagnostic: diagnosticSchema,
  specifications: z.record(z.any()).optional(),
  // CT-003 (audit) : champ mort « priorite » retiré de la création — la
  // priorité est TOUJOURS dérivée de impact + urgence côté serveur
  // (calculatePriority) ; l'accepter ici était un leurre.
});

const updateTicketSchema = z
  .object({
    objet: z.string().trim().min(3).max(200).optional(),
    descriptionDetaillee: z.string().trim().min(10).optional(),
    categorie: z.string().min(1).optional(),
    sousCategorie: z.string().min(1).optional(),
    impact: z.enum(IMPACTS).optional(),
    urgence: z.enum(URGENCES).optional(),
    diagnostic: diagnosticSchema,
    specifications: z.record(z.any()).optional(),
    piecesJointes: z.array(z.string()).optional(),
  })
  .partial();

const changerStatutTicketSchema = z.object({
  statut: z.string().min(1),
  motif: z.string().max(2000).optional(),
  resume: z.string().max(4000).optional(),
  actionCorrective: z.string().max(4000).optional(),
  workaround: z.string().max(4000).optional(),
});

const assignerTicketSchema = z.object({
  assignedTeam: z.string().max(80).optional(),
  assignedTo: z.union([objectId('Technicien invalide'), z.literal(''), z.null()]).optional(),
});

const commenterTicketSchema = z.object({
  corps: z.string().trim().min(1).max(8000),
  visibilite: z.enum(['public', 'interne']).optional(),
  piecesJointes: z.array(z.string()).optional(),
});

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  changerStatutTicketSchema,
  assignerTicketSchema,
  commenterTicketSchema,
};

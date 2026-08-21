const { z } = require('zod');
const { objectId } = require('./common');

const createContratSchema = z.object({
  clientId: objectId('Client (ObjectId) requis'),
  reference: z.string().min(1, 'Référence requise'),
  intitule: z.string().min(1, 'Intitulé requis'),
  typeContrat: z.string().optional(),
  statut: z.enum(['Actif', 'Expiré', 'Suspendu']).optional(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date().optional(),
  description: z.string().optional(),
});

const updateContratSchema = z
  .object({
    // Rattachement/affectation du client (ADMIN)
    clientId: objectId('Client (ObjectId) invalide').optional(),
    intitule: z.string().min(1).optional(),
    typeContrat: z.string().optional(),
    statut: z.enum(['Actif', 'Expiré', 'Suspendu']).optional(),
    dateDebut: z.coerce.date().optional(),
    dateFin: z.coerce.date().optional(),
    description: z.string().optional(),
  })
  .partial();

module.exports = { createContratSchema, updateContratSchema };

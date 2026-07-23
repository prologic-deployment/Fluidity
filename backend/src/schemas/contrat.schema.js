const { z } = require('zod');
const { objectId } = require('./common');

const createContratSchema = z.object({
  clientId: objectId('clientId (ObjectId du Client) requis'),
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
    intitule: z.string().min(1).optional(),
    typeContrat: z.string().optional(),
    statut: z.enum(['Actif', 'Expiré', 'Suspendu']).optional(),
    dateDebut: z.coerce.date().optional(),
    dateFin: z.coerce.date().optional(),
    description: z.string().optional(),
  })
  .partial();

module.exports = { createContratSchema, updateContratSchema };

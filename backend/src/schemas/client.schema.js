const { z } = require('zod');

const createClientSchema = z.object({
  email: z.string().email('Email invalide'),
  nom: z.string().min(1, 'Nom requis'),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  statut: z.enum(['Actif', 'Inactif']).optional(),
  notes: z.string().optional(),
});

const updateClientSchema = z
  .object({
    nom: z.string().min(1).optional(),
    telephone: z.string().optional(),
    adresse: z.string().optional(),
    statut: z.enum(['Actif', 'Inactif']).optional(),
    notes: z.string().optional(),
  })
  .partial();

module.exports = { createClientSchema, updateClientSchema };

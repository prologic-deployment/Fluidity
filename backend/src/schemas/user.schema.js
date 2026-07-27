const { z } = require('zod');
const { objectId } = require('./common');

/**
 * Création d'utilisateur par le Tenant Admin (ou Super Admin).
 * PLATFORM_ADMIN ne peut pas être créé via l'API (compte plateforme
 * provisionné hors bande — seed/ops uniquement).
 */
const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'CLIENT', 'VIEWER']).default('CLIENT'),
  department: z.string().optional(),
  // Requis uniquement si l'appelant est un PLATFORM_ADMIN (création cross-tenant)
  tenantId: objectId('tenantId invalide (ObjectId attendu)').optional(),
});

const updateUserSchema = z
  .object({
    role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'CLIENT', 'VIEWER']).optional(),
    department: z.string().optional(),
    status: z.enum(['invited', 'active', 'suspended']).optional(),
  })
  .partial();

module.exports = { createUserSchema, updateUserSchema };

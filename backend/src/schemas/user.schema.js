const { z } = require('zod');
const { objectId } = require('./common');
const { verifPolitique, LONGUEUR_MIN } = require('../utils/password.util');

/**
 * Création d'utilisateur par le Tenant Admin (ou Super Admin).
 * PLATFORM_ADMIN ne peut pas être créé via l'API (compte plateforme
 * provisionné hors bande — seed/ops uniquement).
 */
const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  // AUTH-005 : politique renforcée pour tout mot de passe choisi.
  password: z
    .string({ required_error: 'Mot de passe requis' })
    .min(1, 'Mot de passe requis')
    .refine((v) => verifPolitique(v) === null, {
      message: `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères dont une majuscule, une minuscule, un chiffre et un caractère spécial.`,
    }),
  role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER']).default('VIEWER'),
  // CT-003 (audit) : le statut « invited » est désormais atteignable à la
  // création (avant : forcé « active »). Un compte invité ne peut pas se
  // connecter tant qu'un admin ne l'active pas (contrôle au login).
  status: z.enum(['invited', 'active']).default('active'),
  department: z.string().optional(),
  // Requis uniquement si l'appelant est un PLATFORM_ADMIN (création cross-tenant)
  tenantId: objectId('tenantId invalide (ObjectId attendu)').optional(),
});

const updateUserSchema = z
  .object({
    role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER']).optional(),
    department: z.string().optional(),
    status: z.enum(['invited', 'active', 'suspended']).optional(),
    /** Réinitialisation 2FA par l'admin (jamais de secret exposé). */
    resetTwoFactor: z.literal(true).optional(),
    // Requis uniquement si l'appelant est un PLATFORM_ADMIN (portée cross-tenant)
    tenantId: objectId('tenantId invalide (ObjectId attendu)').optional(),
  })
  .partial();

module.exports = { createUserSchema, updateUserSchema };

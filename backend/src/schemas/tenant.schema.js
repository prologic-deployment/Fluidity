const { z } = require('zod');
const { verifPolitique, LONGUEUR_MIN } = require('../utils/password.util');

const hexColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const tenantBrandingSchema = z
  .object({
    logoUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
    primaryColor: z.string().regex(hexColor, 'Couleur hexadécimale invalide').optional(),
    secondaryColor: z.string().regex(hexColor, 'Couleur hexadécimale invalide').optional(),
    emailSignature: z.string().optional(),
  })
  .partial();

/** Compte Tenant Admin éventuellement créé en même temps que le tenant. */
const tenantAdminSchema = z.object({
  email: z.string().email('Email du Tenant Admin invalide'),
  // AUTH-005/008 (audit) : la politique renforcée s'applique aussi au Tenant
  // Admin créé avec le tenant (avant : simple min(6)).
  password: z
    .string({ required_error: 'Mot de passe du Tenant Admin requis' })
    .min(1, 'Mot de passe du Tenant Admin requis')
    .refine((v) => verifPolitique(v) === null, {
      message: `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères dont une majuscule, une minuscule, un chiffre et un caractère spécial.`,
    }),
});

const createTenantSchema = z.object({
  name: z.string().min(1, 'Nom du tenant requis'),
  type: z.enum(['Company', 'Individual']).default('Company'),
  contactEmail: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  plan: z.enum(['Free', 'Starter', 'Professional', 'Enterprise']).optional(),
  maxUsers: z.coerce.number().int().min(1).optional(),
  storageQuotaMb: z.coerce.number().int().min(0).optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  ...tenantBrandingSchema.shape,
  admin: tenantAdminSchema.optional(),
});

const updateTenantSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(['Company', 'Individual']).optional(),
    contactEmail: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    website: z.string().optional(),
    plan: z.enum(['Free', 'Starter', 'Professional', 'Enterprise']).optional(),
    maxUsers: z.coerce.number().int().min(1).optional(),
    storageQuotaMb: z.coerce.number().int().min(0).optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    ...tenantBrandingSchema.shape,
  })
  .partial();

module.exports = { createTenantSchema, updateTenantSchema };

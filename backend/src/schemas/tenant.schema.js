const { z } = require('zod');

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
  password: z.string().min(6, 'Mot de passe : 6 caractères minimum'),
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

const { z } = require('zod');

const createTenantSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  slug: z
    .string()
    .min(2, 'Identifiant (slug) requis')
    .regex(/^[a-z0-9-]+$/, 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets')
    .optional(),
  type: z.enum(['Company', 'Individual']).default('Company'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  plan: z.enum(['Free', 'Starter', 'Business', 'Enterprise']).optional(),
  maxUsers: z.coerce.number().int().positive().optional(),
  status: z.enum(['Active', 'Suspended', 'Trial', 'Cancelled']).optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  emailSignature: z.string().optional(),
});

const updateTenantSchema = createTenantSchema.partial();

module.exports = { createTenantSchema, updateTenantSchema };

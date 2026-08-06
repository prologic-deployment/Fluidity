const { z } = require('zod');

const registerSchema = z.object({
  // ObjectId du Tenant auquel rattacher l'utilisateur
  tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'tenantId invalide (ObjectId attendu)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'CLIENT', 'VIEWER']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

/**
 * Mise à jour de SON profil. Liste blanche stricte : email, rôle, statut ou
 * tenant ne sont PAS modifiables ici (l'email sert d'identifiant de connexion ;
 * seul un workflow dédié pourrait le changer).
 */
const updateProfileSchema = z.object({
  firstName: z.string().max(80, 'Prénom trop long (80 max)').optional(),
  lastName: z.string().max(80, 'Nom trop long (80 max)').optional(),
  phone: z
    .string()
    .max(30, 'Téléphone trop long (30 max)')
    .regex(/^[+0-9 .\-()]*$/, 'Numéro de téléphone invalide')
    .optional(),
  jobTitle: z.string().max(120, 'Intitulé de poste trop long (120 max)').optional(),
  bio: z.string().max(1000, 'Biographie trop longue (1000 max)').optional(),
  address: z.string().max(300, 'Adresse trop longue (300 max)').optional(),
  avatarUrl: z
    .string()
    .max(500)
    .regex(/^\/uploads\//, "L'avatar doit provenir du service d'upload")
    .nullable()
    .optional(),
  timezone: z.string().max(60).optional(),
  language: z.enum(['fr', 'en']).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
};

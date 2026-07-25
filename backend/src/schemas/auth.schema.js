const { z } = require('zod');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const registerSchema = z.object({
  tenantId: z.string().regex(OBJECT_ID_REGEX, 'tenantId invalide'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  // SUPER_ADMIN volontairement exclu : ce rôle plateforme ne peut pas être
  // auto-attribué via l'inscription publique (créé uniquement par seed/migration).
  role: z.enum(['CLIENT', 'ADMIN', 'SUPPORT_N1', 'RESPONSABLE_TECHNIQUE', 'COMMERCIAL', 'EXPLOITATION']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
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
};

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

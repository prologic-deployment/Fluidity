const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
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

/** Mise à jour de SON propre profil (liste blanche stricte). */
const updateProfileSchema = z
  .object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(40).optional(),
    jobTitle: z.string().max(120).optional(),
    bio: z.string().max(1000).optional(),
    address: z.string().max(300).optional(),
    avatarUrl: z.string().max(500).nullable().optional(),
  })
  .partial();

/** Changement de son propre mot de passe (mot de passe actuel exigé). */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
    confirmation: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.newPassword === data.confirmation, {
    message: 'La confirmation ne correspond pas au nouveau mot de passe',
    path: ['confirmation'],
  });

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
};

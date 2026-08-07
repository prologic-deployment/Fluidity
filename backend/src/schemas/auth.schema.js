const { z } = require('zod');
const { AVATAR_RELATIF_REGEX, normaliserUrlUpload } = require('../utils/upload-file.util');

const registerSchema = z.object({
  // ObjectId du Tenant auquel rattacher l'utilisateur
  tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'tenantId invalide (ObjectId attendu)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER']).optional(),
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
    // POST /api/uploads renvoie une URL ABSOLUE (http://hôte/uploads/...) :
    // normalisée ici en chemin relatif canonique avant validation — sans ça,
    // tout enregistrement de photo de profil échouait avec un 400.
    .transform((url) => normaliserUrlUpload(url))
    .pipe(
      z
        .string()
        .regex(AVATAR_RELATIF_REGEX, "L'avatar doit être une image (PNG, JPEG, WEBP) issue du service d'upload")
    )
    .nullable()
    .optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

/** Changement de SON mot de passe : mot de passe actuel prouvé + nouveau (mêmes règles que l'inscription). */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
};

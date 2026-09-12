const { z } = require('zod');
const { verifPolitique, LONGUEUR_MIN } = require('../utils/password.util');

/**
 * Mot de passe choisi par un humain : politique renforcée (AUTH-005 audit) —
 * ≥ 12 caractères + 4 classes. Le refus porte un message actionnable.
 */
const motDePasseFort = (champ = 'mot de passe') =>
  z
    .string({ required_error: 'Mot de passe requis' })
    .min(1, 'Mot de passe requis')
    .refine((v) => verifPolitique(v) === null, {
      message: `Le ${champ} doit contenir au moins ${LONGUEUR_MIN} caractères dont une majuscule, une minuscule, un chiffre et un caractère spécial.`,
    });
const { AVATAR_RELATIF_REGEX, normaliserUrlUpload } = require('../utils/upload-file.util');

// AUTH-001 (audit) : registerSchema supprimé avec la route /register —
// l'inscription publique acceptait un rôle TENANT_ADMIN sans authentification.

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
  password: motDePasseFort('nouveau mot de passe'),
});

/** Changement de SON mot de passe : mot de passe actuel prouvé + nouveau (politique renforcée AUTH-005). */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: motDePasseFort('nouveau mot de passe'),
});

module.exports = {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
};

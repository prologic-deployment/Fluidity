const { z } = require('zod');

/**
 * Schémas de validation — double authentification.
 * Le « code » accepté est soit un OTP à 6 chiffres (TOTP), soit un code de
 * secours au format « XXXX-XXXX » (usage unique).
 */

const codeRegex = /^(\d{6}|[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4})$/;

const twoFactorVerifySetupSchema = z.object({
  code: z
    .string({ required_error: 'Code de vérification requis' })
    .regex(codeRegex, 'Code attendu : 6 chiffres (ou un code de secours « XXXX-XXXX »)'),
});

const twoFactorDisableSchema = z
  .object({
    password: z.string().min(1, 'Mot de passe requis').optional(),
    code: z.string().regex(codeRegex, 'Code attendu : 6 chiffres (ou un code de secours « XXXX-XXXX »)').optional(),
  })
  .refine((data) => data.password || data.code, {
    message: 'Fournissez votre mot de passe ou un code d’authentification pour désactiver la 2FA',
  });

const twoFactorVerifyLoginSchema = z.object({
  twoFactorToken: z.string({ required_error: 'Jeton de vérification requis' }).min(1),
  code: z
    .string({ required_error: 'Code requis' })
    .regex(codeRegex, 'Code attendu : 6 chiffres (ou un code de secours « XXXX-XXXX »)'),
});

module.exports = { twoFactorVerifySetupSchema, twoFactorDisableSchema, twoFactorVerifyLoginSchema };

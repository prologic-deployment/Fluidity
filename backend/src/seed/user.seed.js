const { Utilisateur } = require('../models/user.model');
const { encryptSecret } = require('../utils/crypto.util');
const { generateBackupCodes, hashBackupCode } = require('../utils/two-factor.util');

/** Mot de passe de développement (hashé par le hook pre-save). */
const DEMO_PASSWORD = 'Password123!';

/**
 * Secret TOTP de démonstration (base32, connu) — permet de tester la 2FA :
 *   node -e "console.log(require('speakeasy').totp({ secret: 'JBSWY3DPEHPK3PXP', encoding: 'base32' }))"
 */
const DEMO_2FA_SECRET = 'JBSWY3DPEHPK3PXP';
/** Codes de secours de démonstration (stockés hashés en base). */
const DEMO_2FA_BACKUP = ['AAAA-AAAA', 'BBBB-BBBB', 'CCCC-CCCC', 'DDDD-DDDD', 'EEEE-EEEE'];

/**
 * Comptes INTERNES de démonstration (application mono-organisation).
 * Rôles : ADMIN | SUPPORT_N1 | RESPONSABLE_TECHNIQUE | COMMERCIAL | EXPLOITATION.
 * NB : les comptes CLIENT vivent dans le modèle Client (voir client.seed.js).
 */
const demoUsers = [
  { email: 'admin@fluidity.dev', password: DEMO_PASSWORD, role: 'ADMIN', firstName: 'Leila', lastName: 'Ben Ali', jobTitle: 'Directrice des opérations' },
  { email: 'support@fluidity.dev', password: DEMO_PASSWORD, role: 'SUPPORT_N1', firstName: 'Sarah', lastName: 'Mansour', jobTitle: 'Support N1' },
  { email: 'responsable@fluidity.dev', password: DEMO_PASSWORD, role: 'RESPONSABLE_TECHNIQUE', firstName: 'Nour', lastName: 'Manager', jobTitle: 'Responsable technique' },
  { email: 'commercial@fluidity.dev', password: DEMO_PASSWORD, role: 'COMMERCIAL', firstName: 'Yasmine', lastName: 'Commercial', jobTitle: 'Commerciale' },
  { email: 'exploitation@fluidity.dev', password: DEMO_PASSWORD, role: 'EXPLOITATION', firstName: 'Selma', lastName: 'Ops', jobTitle: 'Exploitation' },
  // 2FA : configuration commencée mais non activée (secret présent, non vérifié)
  {
    email: '2fa.pending@fluidity.dev',
    password: DEMO_PASSWORD,
    role: 'SUPPORT_N1',
    firstName: 'Ines',
    lastName: 'Totp',
    twoFactorEnabled: false,
    twoFactorVerified: false,
    twoFactorSecret: encryptSecret(DEMO_2FA_SECRET),
  },
  // 2FA : compte RÉELLEMENT activé et vérifié (secret TOTP + codes de secours)
  {
    email: '2fa.enabled@fluidity.dev',
    password: DEMO_PASSWORD,
    role: 'SUPPORT_N1',
    firstName: 'Yassine',
    lastName: 'Totp',
    twoFactorEnabled: true,
    twoFactorVerified: true,
    twoFactorCreatedAt: new Date(),
    twoFactorSecret: encryptSecret(DEMO_2FA_SECRET),
    twoFactorBackupCodes: DEMO_2FA_BACKUP.map(hashBackupCode),
  },
];

/**
 * Insère les utilisateurs de démonstration (idempotent : n'ajoute que les
 * comptes absents). Les mots de passe sont hashés via le hook pre-save.
 * @returns {Promise<Record<string, object>>} map email → utilisateur
 */
const seedUsers = async () => {
  const map = {};
  let created = 0;
  for (const u of demoUsers) {
    let user = await Utilisateur.findOne({ email: u.email });
    if (!user) {
      user = await new Utilisateur(u).save();
      created += 1;
    }
    map[u.email] = user;
  }
  console.log(
    created > 0
      ? `[Seed] Utilisateurs : ${created} créé(s) (${demoUsers.length} au total).`
      : `[Seed] Utilisateurs de démonstration déjà présents (${demoUsers.length}).`
  );
  return map;
};

module.exports = { demoUsers, seedUsers, DEMO_PASSWORD, DEMO_2FA_SECRET };

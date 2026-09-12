const crypto = require('crypto');

/**
 * Chiffrement symétrique des secrets applicatifs (AES-256-GCM).
 *
 * Utilisé pour stocker les secrets TOTP de la double authentification :
 * jamais en clair en base (cf. exigence « never store the plain secret »).
 *
 * La clé vient de l'environnement :
 *   - TWO_FACTOR_ENCRYPTION_KEY dédiée (recommandé en production),
 *   - à défaut, dérivation scrypt de JWT_SECRET avec un sel propre à cet
 *     usage — acceptable en développement, pas en production.
 *
 * Format stocké : `v1.<iv_b64>.<tag_b64>.<cipher_b64>` — authentifié (GCM),
 * toute altération fait échouer le déchiffrement.
 */

const ALGO = 'aes-256-gcm';
const FORMAT = 'v1';
let cachedKey = null;
let warnedFallback = false;

function getKey() {
  if (cachedKey) return cachedKey;
  const dedicated = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (dedicated && dedicated.length >= 32) {
    // Clé dédiée : normalisée à 32 octets via SHA-256 (accepte hex ou libre)
    cachedKey = crypto.createHash('sha256').update(String(dedicated)).digest();
    return cachedKey;
  }
  // CFG-003 (audit) : plus AUCUNE clé codée en dur. En production l'absence de
  // configuration est une erreur bloquante ; en développement on dérive la clé
  // de JWT_SECRET (qui doit de toute façon être défini — sinon échec immédiat).
  const base = process.env.JWT_SECRET;
  if (!base) {
    throw new Error(
      'Configuration manquante : TWO_FACTOR_ENCRYPTION_KEY (≥ 32 caractères) ou JWT_SECRET est requis pour chiffrer les secrets 2FA.'
    );
  }
  if (!warnedFallback) {
    console.warn(
      '[ServiceDesk] TWO_FACTOR_ENCRYPTION_KEY non définie (≥ 32 caractères) — ' +
        'les secrets 2FA sont chiffrés avec une clé dérivée de JWT_SECRET. ' +
        'Définissez une clé dédiée en production (.env).'
    );
    warnedFallback = true;
  }
  cachedKey = crypto.scryptSync(base, 'servicedesk-2fa-key-derivation', 32);
  return cachedKey;
}

/** Chiffre une chaîne ; retourne le blob stockable `v1.iv.tag.cipher`. */
function encryptSecret(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;
  const iv = crypto.randomBytes(12); // 96 bits — recommandé pour GCM
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

/**
 * Déchiffre un blob `v1.iv.tag.cipher`.
 * Lève une erreur si le format est inconnu ou si l'intégrité échoue
 * (clé changée, donnée corrompue, altération).
 */
function decryptSecret(blob) {
  if (!blob) return null;
  const parts = String(blob).split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error('Format de secret 2FA inconnu (donnée corrompue ?)');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/** Hash d'entropie nulle pour comparaisons de codes à usage unique (SHA-256). */
function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { encryptSecret, decryptSecret, hashValue };

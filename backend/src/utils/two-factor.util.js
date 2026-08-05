const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { PLATFORM_NAME } = require('../config/branding');
const { hashValue } = require('./crypto.util');

/**
 * Double authentification TOTP (RFC 6238) — compatible Google Authenticator,
 * Microsoft Authenticator, Authy et toute application standard.
 *
 * Le secret TOTP n'est JAMAIS persisté en clair : il est chiffré avant
 * stockage (crypto.util) et ne voyage en clair qu'au moment de
 * l'activation (clé manuelle + QR code, usage unique pendant le setup).
 */

/** Code OTP : exactement 6 chiffres. */
const OTP_CODE_REGEX = /^\d{6}$/;
/** Code de secours : 4 + 4 caractères alphanumériques sans ambiguïté (ex. « K3F8-9QT2 »). */
const BACKUP_CODE_REGEX = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/i;

/** Fenêtre de tolérance : ±1 pas de 30 s (dérive d'horloge du téléphone). */
const TOTP_WINDOW = 1;
/** Nombre de codes de secours générés à l'activation. */
const BACKUP_CODES_COUNT = 10;

/**
 * Génère un nouveau secret TOTP pour un compte.
 * Retourne { base32 (clé manuelle), otpauthUrl (destiné au QR code, jamais stocké) }.
 */
function generateSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `${PLATFORM_NAME}:${email}`,
    issuer: PLATFORM_NAME,
    length: 20, // 160 bits — recommandation RFC 4226
  });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url };
}

/** Produit le QR code (image PNG en data URL) — généré à la volée, jamais stocké. */
async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });
}

/** Vérifie un code OTP à 6 chiffres contre un secret TOTP en clair. */
function verifyToken(base32Secret, code) {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: String(code),
    window: TOTP_WINDOW,
  });
}

/** Génère un lot de codes de secours lisibles (en clair — à montrer UNE fois). */
function generateBackupCodes() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I — pas d'ambiguïté
  const codes = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    const raw = Array.from(crypto.randomBytes(8))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/** Hash de stockage d'un code de secours (SHA-256 — jamais le code en clair en base). */
function hashBackupCode(code) {
  return hashValue(String(code).trim().toUpperCase());
}

const isOtpCode = (code) => OTP_CODE_REGEX.test(String(code || ''));
const isBackupCode = (code) => BACKUP_CODE_REGEX.test(String(code || ''));

module.exports = {
  generateSecret,
  generateQrCodeDataUrl,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  isOtpCode,
  isBackupCode,
};

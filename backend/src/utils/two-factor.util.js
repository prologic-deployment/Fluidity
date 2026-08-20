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
 * stockage (crypto.util) et ne voyage en clair qu'au moment de l'activation.
 */

const OTP_CODE_REGEX = /^\d{6}$/;
const BACKUP_CODE_REGEX = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/i;

/** Fenêtre de tolérance : ±1 pas de 30 s (dérive d'horloge du téléphone). */
const TOTP_WINDOW = 1;
/** Nombre de codes de secours générés à l'activation. */
const BACKUP_CODES_COUNT = 10;

function generateSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `${PLATFORM_NAME}:${email}`,
    issuer: PLATFORM_NAME,
    length: 20,
  });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url };
}

async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });
}

function verifyToken(base32Secret, code) {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: String(code),
    window: TOTP_WINDOW,
  });
}

function generateBackupCodes() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    const raw = Array.from(crypto.randomBytes(8))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

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

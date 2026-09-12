const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { RefreshToken } = require('../models/refresh-token.model');

/**
 * Gestion des sessions : jetons de rafraîchissement ROTATIFS en cookie
 * httpOnly + révocation (AUTH-003, audit).
 *
 * Modèle :
 *   login  → cookie refresh (famille F1)  + JWT accès courte durée
 *   refresh→ rotation : l'ancien jeton est révoqué/remplacé, un nouveau émis
 *   logout → révocation du jeton courant (+ cookie effacé)
 *   événement de sécurité (mot de passe, rôle, 2FA…) → revokeAllForPrincipal()
 *   réutilisation d'un jeton déjà remplacé → toute la famille est révoquée.
 *
 * Le jeton brut n'est JAMAIS stocké : seule son empreinte SHA-256 est en base.
 */

const COOKIE_NAME = 'fluidity_rt';
const TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const isProd = () => process.env.NODE_ENV === 'production';

/** Options du cookie refresh : httpOnly, SameSite=Lax, Secure en production. */
function cookieOptions(maxAgeMs = TTL_DAYS * 24 * 3600 * 1000) {
  const parts = [
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'Path=/api/auth',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd() || process.env.COOKIE_SECURE === 'true') parts.push('Secure');
  return parts.join('; ');
}

function setRefreshCookie(res, rawToken) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${rawToken}; ${cookieOptions()}`);
}

function clearRefreshCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieOptions(0)}`);
}

/** Lit le cookie refresh (retourne le jeton BRUT ou null). */
function readRefreshCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=') || null;
  }
  return null;
}

/** Crée une NOUVELLE famille de rafraîchissement (login / 2FA réussi). */
async function issueRefreshToken(req, res, { userId, principalType, tenantId }) {
  const raw = `${uuidv4()}.${crypto.randomBytes(32).toString('hex')}`;
  await RefreshToken.create({
    tokenHash: hashToken(raw),
    userId: String(userId),
    principalType,
    tenantId: tenantId ? String(tenantId) : null,
    familyId: uuidv4(),
    expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: req.ip || '',
  });
  setRefreshCookie(res, raw);
}

/**
 * Rotation : consomme `oldDoc` (déjà résolu depuis son empreinte) et émet son
 * successeur. Retourne le nouveau jeton brut, ou null si le jeton présenté est
 * invalide (expiré/révoqué) — l'appelant doit alors répondre 401.
 */
async function rotateRefreshToken(req, res, oldDoc) {
  if (!oldDoc) return null;
  if (oldDoc.revokedAt || oldDoc.expiresAt < new Date()) return null;

  const raw = `${uuidv4()}.${crypto.randomBytes(32).toString('hex')}`;
  const newHash = hashToken(raw);
  await RefreshToken.create({
    tokenHash: newHash,
    userId: oldDoc.userId,
    principalType: oldDoc.principalType,
    tenantId: oldDoc.tenantId,
    familyId: oldDoc.familyId,
    expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: req.ip || '',
  });
  // Marque l'ancien comme remplacé (la présence de replacedByHash sur un jeton
  // présenté plus tard = réutilisation frauduleuse).
  await RefreshToken.updateOne(
    { _id: oldDoc._id },
    { $set: { revokedAt: new Date(), replacedByHash: newHash } }
  );
  setRefreshCookie(res, raw);
  return raw;
}

/** Résout le jeton du cookie vers son document (ou null). */
async function resolveRefreshToken(req) {
  const raw = readRefreshCookie(req);
  if (!raw) return null;
  return RefreshToken.findOne({ tokenHash: hashToken(raw) });
}

/**
 * Détection de réutilisation : le jeton présenté a déjà été remplacé ⇒
 * suspicion de vol. Révoque TOUTE la famille et signale à l'appelant.
 */
async function reuseDetected(doc) {
  if (!doc || !doc.replacedByHash) return false;
  await RefreshToken.updateMany(
    { familyId: doc.familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return true;
}

/** Révoque le jeton courant (logout) — silencieux si absent. */
async function revokeCurrent(req, res) {
  const doc = await resolveRefreshToken(req);
  if (doc && !doc.revokedAt) {
    await RefreshToken.updateOne({ _id: doc._id }, { $set: { revokedAt: new Date() } });
  }
  clearRefreshCookie(res);
}

/** Révoque TOUTES les familles d'un principal (événement de sécurité). */
async function revokeAllForPrincipal(userId, principalType) {
  await RefreshToken.updateMany(
    { userId: String(userId), principalType, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  COOKIE_NAME,
  hashToken,
  issueRefreshToken,
  rotateRefreshToken,
  resolveRefreshToken,
  reuseDetected,
  revokeCurrent,
  revokeAllForPrincipal,
  readRefreshCookie,
  setRefreshCookie,
  clearRefreshCookie,
};

const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Tenant } = require('../models/tenant.model');
const { PRINCIPAL_CLIENT } = require('../utils/principals');
const { issueSession, verifyTwoFactorToken } = require('./auth.controller');

async function loadAccountById(id, extraSelect = '') {
  const client = await Client.findById(id).select(extraSelect);
  if (client) return { account: client, principalType: PRINCIPAL_CLIENT };
  const user = await Utilisateur.findById(id).select(extraSelect);
  if (user) return { account: user, principalType: 'UTILISATEUR' };
  return { account: null, principalType: null };
}

async function loadSessionAccount(req, extraSelect = '') {
  if (req.principalType === PRINCIPAL_CLIENT) {
    const account = await Client.findById(req.userId).select(extraSelect);
    return { account, principalType: PRINCIPAL_CLIENT };
  }
  const account = await Utilisateur.findById(req.userId).select(extraSelect);
  return { account, principalType: 'UTILISATEUR' };
}
const { enregistrerActivite } = require('../utils/login-activity.util');
const { sendTwoFactorEnabledEmail, sendTwoFactorDisabledEmail } = require('../services/email.service');
const { encryptSecret, decryptSecret } = require('../utils/crypto.util');
const {
  generateSecret,
  generateQrCodeDataUrl,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  isOtpCode,
} = require('../utils/two-factor.util');

/**
 * Double authentification (2FA) TOTP — chaque utilisateur gère SA propre 2FA.
 *
 * Cycle de vie :
 *   POST /api/auth/2fa/setup        -> secret chiffré (en attente) + QR code + clé manuelle
 *   POST /api/auth/2fa/verify-setup -> code OTP valide => activation + codes de secours
 *   POST /api/auth/login            -> si 2FA active : jeton temporaire (5 min), pas de session
 *   POST /api/auth/2fa/verify-login -> code OTP (ou code de secours) => session complète
 *   POST /api/auth/2fa/disable      -> désactivation (mot de passe OU code valide requis)
 *
 * Règles de sécurité : le secret TOTP est chiffré en base (AES-256-GCM),
 * jamais renvoyé par l'API ; les codes de secours sont hachés (SHA-256) et
 * à usage unique ; le QR code et la clé manuelle ne sont émis que pendant
 * le setup ; un admin ne voit jamais le secret (il peut seulement réinitialiser).
 */

/**
 * Vérifie un « code » fourni : OTP TOTP valide, ou code de secours correspondant
 * (hachage comparé, consommé si `consumeBackup === true`).
 * Retourne { ok, backupUsed }.
 */
function checkCode(user, plainSecret, code, consumeBackup) {
  const trimmed = String(code || '').trim();
  if (isOtpCode(trimmed)) {
    return { ok: verifyToken(plainSecret, trimmed), backupUsed: false };
  }
  // Code de secours ? (format XXXX-XXXX)
  const hashes = user.twoFactorBackupCodes || [];
  const idx = hashes.indexOf(hashBackupCode(trimmed));
  if (idx >= 0) {
    if (consumeBackup) hashes.splice(idx, 1); // usage unique
    return { ok: true, backupUsed: true };
  }
  return { ok: false, backupUsed: false };
}

/** GET /api/auth/2fa/status — état courant (jamais de secret). */
const getStatus = async (req, res) => {
  try {
    const { account: user } = await loadSessionAccount(req, '+twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'Compte introuvable' });
      return;
    }
    res.status(200).json({
      enabled: !!user.twoFactorEnabled,
      verified: !!user.twoFactorVerified,
      createdAt: user.twoFactorCreatedAt || null,
      backupCodesRemaining: user.twoFactorEnabled ? (user.twoFactorBackupCodes || []).length : 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /api/auth/2fa/setup — génère un secret (stocké chiffré, en attente de
 * vérification) + le QR code (généré à la volée, jamais stocké) + la clé
 * manuelle. Renouvelable tant que la 2FA n'est pas activée.
 */
const setup = async (req, res) => {
  try {
    const { account: user } = await loadSessionAccount(req, '+twoFactorSecret');
    if (!user) {
      res.status(404).json({ message: 'Compte introuvable' });
      return;
    }
    if (user.twoFactorEnabled) {
      res.status(409).json({
        message: 'La double authentification est déjà activée. Désactivez-la d’abord pour la reconfigurer.',
      });
      return;
    }

    const { base32, otpauthUrl } = generateSecret(req.userEmail);
    const qrCode = await generateQrCodeDataUrl(otpauthUrl);

    // Secret chiffré, en attente : activation uniquement après OTP valide
    user.twoFactorSecret = encryptSecret(base32);
    user.twoFactorEnabled = false;
    user.twoFactorVerified = false;
    user.twoFactorBackupCodes = [];
    await user.save();

    res.status(200).json({
      qrCode, // data URL du QR — jamais persistée
      manualKey: base32, // clé manuelle — affichée uniquement pendant le setup
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /api/auth/2fa/verify-setup — confirme le premier code OTP de
 * l'application d'authentification : active la 2FA et génère les codes de
 * secours (renvoyés UNE seule fois, hachés en base).
 */
const verifySetup = async (req, res) => {
  try {
    const { account: user } = await loadSessionAccount(req, '+twoFactorSecret');
    if (!user) {
      res.status(404).json({ message: 'Compte introuvable' });
      return;
    }
    if (user.twoFactorEnabled) {
      res.status(409).json({ message: 'La double authentification est déjà activée.' });
      return;
    }
    if (!user.twoFactorSecret) {
      res.status(400).json({ message: 'Aucune configuration en cours. Lancez d’abord la génération du QR code.' });
      return;
    }

    const plainSecret = decryptSecret(user.twoFactorSecret);
    if (!verifyToken(plainSecret, req.body.code)) {
      res.status(400).json({ message: 'Code invalide. Vérifiez le code affiché par votre application, puis réessayez.' });
      return;
    }

    const backupCodes = generateBackupCodes();
    user.twoFactorEnabled = true;
    user.twoFactorVerified = true;
    user.twoFactorCreatedAt = new Date();
    user.twoFactorBackupCodes = backupCodes.map(hashBackupCode);
    await user.save();

    sendTwoFactorEnabledEmail(user.email).catch(console.error);

    res.status(200).json({
      message: 'Double authentification activée avec succès.',
      // Montrés UNE seule fois — jamais stockés ni renvoyés ensuite en clair
      backupCodes,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /api/auth/2fa/disable — désactive la 2FA et purge secret + codes de
 * secours. Exige une preuve : mot de passe du compte OU code 2FA valide.
 */
const disable = async (req, res) => {
  try {
    const { account: user } = await loadSessionAccount(req, '+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      res.status(404).json({ message: 'Compte introuvable' });
      return;
    }
    if (!user.twoFactorEnabled) {
      res.status(400).json({ message: 'La double authentification n’est pas activée sur ce compte.' });
      return;
    }

    const { password, code } = req.body;
    let preuveOk = false;
    if (code) {
      const plainSecret = decryptSecret(user.twoFactorSecret);
      preuveOk = checkCode(user, plainSecret, code, false).ok;
    }
    if (!preuveOk && password) {
      preuveOk = await user.comparePassword(password);
    }
    if (!preuveOk) {
      res.status(401).json({ message: 'Preuve d’identité invalide (mot de passe ou code incorrect).' });
      return;
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorVerified = false;
    user.twoFactorCreatedAt = null;
    user.twoFactorBackupCodes = [];
    await user.save();

    sendTwoFactorDisabledEmail(user.email).catch(console.error);

    res.status(200).json({ message: 'Double authentification désactivée.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /api/auth/2fa/verify-login — second facteur de la connexion :
 * jeton temporaire (preuve du mot de passe, 5 min) + code OTP (ou code de
 * secours, consommé) => session JWT complète.
 */
const verifyLogin = async (req, res) => {
  try {
    let userId;
    try {
      userId = verifyTwoFactorToken(req.body.twoFactorToken);
    } catch {
      res.status(401).json({ message: 'Session de vérification expirée. Recommencez la connexion.' });
      return;
    }

    const { account: user, principalType } = await loadAccountById(userId, '+twoFactorSecret +twoFactorBackupCodes');
    if (!user || !user.twoFactorEnabled) {
      res.status(401).json({ message: 'Vérification impossible pour ce compte.' });
      return;
    }
    const estClient = principalType === PRINCIPAL_CLIENT;
    if (!estClient && user.status === 'suspended') {
      res.status(403).json({ message: 'Ce compte est suspendu. Contactez votre administrateur.' });
      return;
    }
    if (estClient && user.statut !== 'Actif') {
      res.status(403).json({ message: 'Ce compte est inactif. Contactez votre administrateur.' });
      return;
    }

    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'terminated') {
        res.status(403).json({ message: "Cet espace de travail n'existe plus." });
        return;
      }
      if (tenant.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
        res.status(403).json({
          message: 'Cet espace de travail est suspendu. Contactez le support de la plateforme.',
        });
        return;
      }
    }

    const plainSecret = decryptSecret(user.twoFactorSecret);
    const { ok, backupUsed } = checkCode(user, plainSecret, req.body.code, true);
    if (!ok) {
      enregistrerActivite(req, {
        userId: user._id, tenantId: user.tenantId || null,
        principalType: estClient ? PRINCIPAL_CLIENT : 'UTILISATEUR',
        succes: false, mfaUtilise: true, raisonEchec: 'CODE_2FA_INVALIDE',
      });
      res.status(401).json({ message: 'Code invalide. Réessayez.' });
      return;
    }
    if (backupUsed) await user.save();

    issueSession(res, user, tenant, { backupCodeUsed: backupUsed }, {
      req,
      mfaUtilise: true,
      principalType: estClient ? PRINCIPAL_CLIENT : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { getStatus, setup, verifySetup, disable, verifyLogin };
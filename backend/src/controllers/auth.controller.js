const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail } = require('../services/email.service');

/** Marque renvoyée au frontend pour afficher le workspace (white-label). */
const tenantBranding = (tenant) =>
  tenant
    ? {
        _id: tenant._id,
        name: tenant.name,
        type: tenant.type,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        plan: tenant.plan,
        timezone: tenant.timezone,
        language: tenant.language,
      }
    : null;

/**
 * Inscription d'un nouvel utilisateur (rattachement à un tenant existant).
 * Réservée aux flux d'intégration ; la création d'utilisateurs se fait
 * normalement via /api/users (Tenant Admin) ou /api/tenants (Super Admin).
 */
const register = async (req, res) => {
  try {
    const { tenantId, email, password, role } = req.body;

    const tenant = await Tenant.findOne({ _id: tenantId, status: 'active' });
    if (!tenant) {
      res.status(400).json({ message: 'Tenant invalide ou inactif' });
      return;
    }

    const existing = await Utilisateur.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    const user = new Utilisateur({
      tenantId,
      email,
      password,
      role: role || 'CLIENT',
    });
    await user.save();

    res.status(201).json({ message: 'Utilisateur créé avec succès', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Connexion : vérifie les identifiants et renvoie un JWT + la marque du
 * tenant (nom, logo, couleurs) pour construire l'expérience workspace.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Utilisateur.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    if (user.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
      res.status(403).json({ message: 'Ce compte est suspendu. Contactez votre administrateur.' });
      return;
    }

    // Marque du workspace + blocage si le tenant est suspendu
    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'terminated') {
        res.status(403).json({ message: 'Cet espace de travail n\'existe plus.' });
        return;
      }
      if (tenant.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
        res.status(403).json({
          message: 'Cet espace de travail est suspendu. Contactez le support de la plateforme.',
        });
        return;
      }
    }

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { tenantId: user.tenantId || null, userId: user._id, role: user.role, email: user.email },
      secret,
      { expiresIn }
    );

    res.status(200).json({
      token,
      userId: user._id,
      tenantId: user.tenantId || null,
      role: user.role,
      email: user.email,
      status: user.status,
      tenant: tenantBranding(tenant),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mot de passe oublié : génère un token UUID (valable 1h) et envoie
 * un email de réinitialisation de façon asynchrone.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Utilisateur.findOne({ email });
    // Réponse neutre pour ne pas révéler l'existence de l'email
    if (!user) {
      res.status(200).json({
        message: "Si l'email existe, un lien de réinitialisation a été envoyé",
      });
      return;
    }

    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    // Envoi asynchrone (ne bloque pas la réponse HTTP)
    sendResetPasswordEmail(email, token).catch(console.error);

    res.status(200).json({
      message: "Si l'email existe, un lien de réinitialisation a été envoyé",
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Réinitialisation effective du mot de passe à partir d'un token valide.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await Utilisateur.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      res.status(400).json({ message: 'Token invalide ou expiré' });
      return;
    }

    user.password = password; // hashé via le hook pre-save
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Renvoie le profil de l'utilisateur authentifié (+ sa marque de tenant),
 * sans données sensibles. Utilisé par le frontend au rechargement.
 */
const me = async (req, res) => {
  try {
    const filter = { _id: req.userId };
    if (req.tenantId) filter.tenantId = req.tenantId;
    const user = await Utilisateur.findOne(filter).select('-password -resetToken -resetTokenExpiry');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json({ user, tenant: tenantBranding(req.tenant || null) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { register, login, forgotPassword, resetPassword, me };

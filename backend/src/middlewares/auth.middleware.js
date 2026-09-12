const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Utilisateur, ROLES } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { Client } = require('../models/client.model');
const { PRINCIPAL_UTILISATEUR, PRINCIPAL_CLIENT, ROLE_PORTAIL } = require('../utils/principals');

/** Message d'aide quand la session/le compte provient de données pré-multi-tenant. */
const LEGACY_MESSAGE =
  'Ce compte provient d’une ancienne version des données (identifiants hérités, rôles obsolètes). ' +
  'Exécutez « npm run migrate » côté backend pour convertir les données, puis reconnectez-vous.';

/**
 * Middleware d'authentification + contexte tenant.
 *
 * 1. Vérifie le JWT ("Authorization: Bearer <token>") et injecte
 *    req.tenantId, req.userId, req.userRole, req.userEmail, req.principalType.
 *    Deux types de principals (utils/principals) :
 *      UTILISATEUR — compte interne (rôle RBAC dans ROLES) ;
 *      CLIENT      — accès portail de l'entité Client (rôle effectif ROLE_PORTAIL
 *                    dans le jeton ; req.userClientId = sa propre fiche).
 * 2. Recharge le principal : un compte suspendu/inactif est immédiatement
 *    bloqué (les JWT étant sans état, la DB fait foi).
 * 3. Charge le Tenant : un tenant « suspended » ou « terminated » coupe
 *    tout accès à ses utilisateurs (le Super Admin plateforme passe).
 * 4. Impersonation : un PLATFORM_ADMIN peut agir "comme" un tenant via
 *    l'en-tête `x-tenant-override: <tenantId>` (audit + support).
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentification requise' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ message: 'Configuration JWT manquante' });
      return;
    }

    const decoded = jwt.verify(token, secret);

    // Les jetons à usage spécifique (ex. défi 2FA, 5 min) ne sont JAMAIS des
    // sessions : tout jeton portant une mention « purpose » est rejeté ici.
    if (decoded.purpose) {
      res.status(401).json({ message: 'Ce jeton ne peut pas servir de session.' });
      return;
    }

    req.tenantId = decoded.tenantId || null;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    // « iat » du jeton : identifiant d'émission de la session courante
    // (mise en évidence dans le journal d'activité de connexion).
    req.tokenIat = decoded.iat || null;

    req.principalType = decoded.principal === PRINCIPAL_CLIENT ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR;

    // --- Principal CLIENT (accès portail de l'entité commerciale) ---
    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findById(req.userId).select('email tenantId statut mustChangePassword tokenVersion').lean();
      if (!client) {
        res.status(401).json({ message: 'Compte introuvable ou supprimé' });
        return;
      }
      // AUTH-003 : révocation de session (jeton émis avant un événement de sécurité).
      if (client.tokenVersion != null && decoded.tv != null && decoded.tv !== client.tokenVersion) {
        res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Session révoquée. Veuillez vous reconnecter.' });
        return;
      }
      if (client.statut !== 'Actif') {
        res.status(403).json({ message: 'Ce compte est inactif. Contactez votre administrateur.' });
        return;
      }
      req.userRole = ROLE_PORTAIL;
      req.userClientId = client._id;
      req.mustChangePassword = !!client.mustChangePassword;
    } else {
      // --- Vérification du compte interne (suspension temps réel) ---
      const user = await Utilisateur.findById(req.userId).select('role status tenantId tokenVersion').lean();
      if (!user) {
        res.status(401).json({ message: 'Compte introuvable ou supprimé' });
        return;
      }
      // AUTH-003 (audit) : révocation de session par « tokenVersion ». Toute
      // élévation d'événement de sécurité (mot de passe changé/réinitialisé,
      // rôle modifié, suspension, 2FA réinitialisée) incrémente le compteur ;
      // un jeton émis avant l'événement est rejeté immédiatement.
      if (user.tokenVersion != null && decoded.tv != null && decoded.tv !== user.tokenVersion) {
        res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Session révoquée. Veuillez vous reconnecter.' });
        return;
      }
      if (user.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
        res.status(403).json({ message: 'Ce compte est suspendu. Contactez votre administrateur.' });
        return;
      }
      if (!ROLES.includes(user.role)) {
        res.status(403).json({ message: LEGACY_MESSAGE });
        return;
      }
      // AUTH-002 (audit) : le rôle d'autorisation provient TOUJOURS de la DB,
      // jamais du JWT (qui figeait le rôle jusqu'à expiration). Une rétrogradation
      // est donc effective immédiatement, sans attendre la fin de validité du jeton.
      req.userRole = user.role;
      req.userClientId = null;
    }

    // --- Impersonation (PLATFORM_ADMIN uniquement) ---
    if (req.userRole === 'PLATFORM_ADMIN' && req.headers['x-tenant-override']) {
      req.tenantId = req.headers['x-tenant-override'];
      req.impersonated = true;
    }

    // --- Vérification du tenant ---
    if (req.tenantId) {
      // Données héritées (tenantId texte, ex. « tenant-001 ») : guider la
      // migration au lieu d'une erreur de cast illisible.
      if (!mongoose.isValidObjectId(req.tenantId)) {
        res.status(403).json({ message: LEGACY_MESSAGE });
        return;
      }
      const tenant = await Tenant.findById(req.tenantId).lean();
      if (!tenant) {
        res.status(401).json({ message: 'Tenant introuvable ou supprimé' });
        return;
      }
      if (tenant.status !== 'active' && req.userRole !== 'PLATFORM_ADMIN') {
        res.status(403).json({
          message: 'Cet espace de travail est suspendu. Contactez le support de la plateforme.',
        });
        return;
      }
      req.tenant = tenant;
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

/**
 * N'autorise que les comptes internes (jamais un principal CLIENT portail) —
 * ex. configuration 2FA, réservée aux Utilisateurs.
 */
function requireUtilisateurInterne(req, res, next) {
  if (req.principalType === PRINCIPAL_CLIENT) {
    res.status(403).json({ message: 'Cette fonctionnalité est réservée aux utilisateurs internes.' });
    return;
  }
  next();
}

/**
 * AUTHZ-001 (audit) : le rôle interne VIEWER (« Consultation ») est en
 * LECTURE SEULE — il ne peut produire AUCUNE écriture métier (édition de
 * demandes / changements / tickets, assignation, commentaires, transitions).
 * Les principaux CLIENT passent ici : leur droit d'écriture est ensuite borné
 * à LEURS propres enregistrements par les contrôleurs (filtreProprietaire).
 */
function refuseViewer(req, res, next) {
  if (req.userRole === 'VIEWER') {
    res.status(403).json({
      code: 'ROLE_LECTURE_SEULE',
      message: 'Le rôle « Consultation » est en lecture seule : aucune modification n\'est autorisée.',
    });
    return;
  }
  next();
}

module.exports = {
  authMiddleware,
  requireRole,
  requirePlatformAdmin,
  requireTenantAdmin,
  requireUtilisateurInterne,
  requirePasswordChanged,
  refuseViewer,
};

/**
 * Accès interdit tant que le principal utilise un mot de passe provisoire
 * généré par l'administrateur (mustChangePassword) — la première action de
 * son accès portail doit être d'en choisir un définitif.
 */
function requirePasswordChanged(req, res, next) {
  if (req.principalType === PRINCIPAL_CLIENT && req.mustChangePassword) {
    res.status(403).json({
      code: 'MOT_DE_PASSE_PROVISOIRE',
      message:
        'Vous devez définir un nouveau mot de passe avant d’accéder à l’application. ' +
        'Rendez-vous dans votre page Sécurité.',
    });
    return;
  }
  next();
}

/**
 * Middleware de contrôle d'accès par rôle.
 * Usage : router.post('/', authMiddleware, requireRole('TENANT_ADMIN'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ message: 'Accès refusé : permissions insuffisantes' });
      return;
    }
    next();
  };
}

/** Routes réservées au Super Admin de la plateforme (hors tenant). */
function requirePlatformAdmin(req, res, next) {
  return requireRole('PLATFORM_ADMIN')(req, res, next);
}

/** Routes d'administration D'UN tenant (Tenant Admin, ou Super Admin en impersonation). */
function requireTenantAdmin(req, res, next) {
  return requireRole('PLATFORM_ADMIN', 'TENANT_ADMIN')(req, res, next);
}

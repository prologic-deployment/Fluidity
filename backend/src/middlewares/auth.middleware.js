const jwt = require('jsonwebtoken');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Middleware d'authentification + contexte tenant.
 *
 * 1. Vérifie le JWT ("Authorization: Bearer <token>") et injecte
 *    req.tenantId, req.userId, req.userRole, req.userEmail.
 * 2. Recharge l'utilisateur : un compte suspendu est immédiatement
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
    req.tenantId = decoded.tenantId || null;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;

    // --- Vérification du compte (suspension temps réel) ---
    const user = await Utilisateur.findById(req.userId).select('role status tenantId').lean();
    if (!user) {
      res.status(401).json({ message: 'Compte introuvable ou supprimé' });
      return;
    }
    if (user.status === 'suspended' && req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ message: 'Ce compte est suspendu. Contactez votre administrateur.' });
      return;
    }

    // --- Impersonation (PLATFORM_ADMIN uniquement) ---
    if (req.userRole === 'PLATFORM_ADMIN' && req.headers['x-tenant-override']) {
      req.tenantId = req.headers['x-tenant-override'];
      req.impersonated = true;
    }

    // --- Vérification du tenant ---
    if (req.tenantId) {
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

module.exports = { authMiddleware, requireRole, requirePlatformAdmin, requireTenantAdmin };

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

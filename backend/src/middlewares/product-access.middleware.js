const { assertProductAccess } = require('../services/saas-entitlements.service');
const logger = require('../utils/logger.util');

/**
 * Middleware d'accès produit — L'AUTORITÉ CÔTÉ SERVEUR.
 *
 * Vérifie, pour chaque requête protégée :
 *   authentifié (authMiddleware) ET
 *   membre du tenant (req.tenantId) ET
 *   souscription produit active ET
 *   licence utilisateur assignée (ou admin tenant) ET
 *   permission produit requise.
 *
 * Usage :
 *   router.get('/projects', authMiddleware, requireProductAccess('project_management', 'project.project.read'), handler)
 *
 * Ne JAMAIS se fier au frontend : la sélection produit, le localStorage et
 * le rôle affiché sont ignorés ici.
 */
function requireProductAccess(productKey, permission) {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
      }
      const check = await assertProductAccess({
        tenantId: req.tenantId,
        userId: req.userId,
        principalType: req.principalType,
        internalRole: req.userRole,
        productKey,
        permission: permission || null,
      });
      if (!check.ok) {
        res.status(403).json({
          code: check.code,
          message: 'Accès refusé à ce produit ou à cette ressource.',
        });
        return;
      }
      req.productKey = productKey;
      req.productEntry = check.entry;
      req.entitlements = check.entitlements;
      next();
    } catch (err) {
      logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
      res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
    }
  };
}

module.exports = { requireProductAccess };

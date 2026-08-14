const { AuditLog, Notification } = require('../models/saas.models');

/**
 * Consigne un événement d'audit (plateforme, produit, workflow). Ne lève
 * jamais : l'audit ne doit pas casser le flux métier.
 */
async function audit(req, entry) {
  try {
    await AuditLog.create({
      tenantId: entry.tenantId ?? req?.tenantId ?? null,
      userId: entry.userId ?? req?.userId ?? null,
      principalType: entry.principalType ?? req?.principalType ?? 'UTILISATEUR',
      productId: entry.productId ?? null,
      productKey: entry.productKey || '',
      action: entry.action,
      resource: entry.resource || '',
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata || {},
      ip: req?.ip || '',
    });
  } catch {
    /* audit best-effort */
  }
}

/** Audit d'une transition de workflow (produit). */
async function auditWorkflow(req, productKey, resource, resourceId, from, to, by) {
  await audit(req, {
    action: 'workflow.transition',
    productKey,
    resource,
    resourceId,
    metadata: { from, to, by: by || null },
  });
}

/**
 * Crée une notification utilisateur (produit-aware). Les libellés sont des
 * clés i18n + paramètres — jamais de texte traduit stocké.
 */
async function notify(tenantId, userId, { productId = null, productKey = '', type, titleKey = '', bodyKey = '', params = {}, link = '' }) {
  try {
    await Notification.create({ tenantId, userId, productId, productKey, type, titleKey, bodyKey, params, link });
  } catch {
    /* notifications best-effort */
  }
}

module.exports = { audit, auditWorkflow, notify };

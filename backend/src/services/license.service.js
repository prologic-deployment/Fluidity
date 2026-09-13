const mongoose = require('mongoose');
const { Product, Subscription, LicenseAssignment } = require('../models/saas.models');
const { Utilisateur } = require('../models/user.model');
const { getProduct } = require('../products/registry');
const { audit } = require('../utils/saas-log.util');
const { notifyUser } = require('./project-notify.service');

/**
 * Service de LICENCES centralisé (A5) — assignation de sièges avec garde
 * anti-surallocation sûre en concurrence.
 *
 * Problème : « sièges = 5, assignés = 5, deux requêtes simultanées → 7 ».
 * Le contrôle « compter puis insérer » ne suffit pas (course entre le comptage
 * et l'insertion). Stratégie sans transaction (compatible MongoDB standalone) :
 *   1. upsert de la licence (index unique USER × TENANT × PRODUIT) ;
 *   2. recomptage des licences actives ;
 *   3. si dépassement → annulation de CETTE licence (suppression si créée,
 *      restauration du statut précédent sinon) + erreur SEATS_EXCEEDED.
 * Le plafond ne peut jamais être durablement dépassé : chaque concurrent qui
 * dépasse annule sa propre écriture. Le cas résiduel (deux concurrents qui
 * s'annulent alors qu'un siège restait) se résout par une nouvelle tentative.
 */

function seatsError(activeCount, seats) {
  const err = new Error('Limite de licences atteinte : demandez des sièges supplémentaires.');
  err.code = 'SEATS_EXCEEDED';
  err.status = 409;
  err.details = { used: activeCount, seats };
  return err;
}

/** Souscription active ouvrant droit à des sièges pour le produit. */
async function grantingSubscription(tenantId, productKey, subscriptionId = null) {
  if (subscriptionId) {
    const explicit = await Subscription.findOne({ _id: subscriptionId, tenantId, productKey });
    if (explicit && ['trial', 'active', 'past_due'].includes(explicit.status)) return explicit;
    return null;
  }
  return Subscription.findOne({ tenantId, productKey, status: { $in: ['trial', 'active', 'past_due'] } });
}

/**
 * Assigne (ou réactive) une licence à un utilisateur.
 * Lève une erreur `code: SEATS_EXCEEDED` (409) si aucun siège n'est libre,
 * `NO_SUBSCRIPTION` (409) sans souscription active, `CROSS_TENANT_LICENSE`
 * (403) si l'utilisateur est hors tenant.
 */
async function assignLicense({ tenantId, userId, productKey, subscriptionId = null, assignedBy = null }, req = null) {
  if (!mongoose.isValidObjectId(userId)) {
    const err = new Error('Utilisateur invalide.');
    err.code = 'INVALID_USER';
    err.status = 400;
    throw err;
  }
  const user = await Utilisateur.findById(userId).select('_id tenantId status').lean();
  if (!user) {
    const err = new Error('Utilisateur introuvable.');
    err.code = 'USER_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (String(user.tenantId) !== String(tenantId)) {
    const err = new Error('Licence refusée : utilisateur hors du tenant.');
    err.code = 'CROSS_TENANT_LICENSE';
    err.status = 403;
    throw err;
  }
  const product = await Product.findOne({ key: productKey }).lean();
  if (!product) {
    const err = new Error('Produit introuvable.');
    err.code = 'PRODUCT_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  const sub = await grantingSubscription(tenantId, productKey, subscriptionId);
  if (!sub) {
    const err = new Error('Aucune souscription active pour ce produit.');
    err.code = 'NO_SUBSCRIPTION';
    err.status = 409;
    throw err;
  }

  const previous = await LicenseAssignment.findOne({ tenantId, userId, productKey }).lean();
  const wasActive = previous?.status === 'active';

  const license = await LicenseAssignment.findOneAndUpdate(
    { tenantId, userId, productKey },
    {
      $set: {
        productId: product._id,
        subscriptionId: sub._id,
        status: 'active',
        assignedBy: assignedBy || null,
        startDate: new Date(),
        endDate: sub.endDate || null,
      },
    },
    { new: true, upsert: true }
  );

  // Garde siège : recomptage APRÈS écriture, annulation en cas de dépassement.
  if (!wasActive) {
    const activeCount = await LicenseAssignment.countDocuments({ tenantId, productKey, status: 'active' });
    if (activeCount > sub.seats) {
      if (!previous) {
        await LicenseAssignment.deleteOne({ _id: license._id });
      } else {
        await LicenseAssignment.updateOne({ _id: license._id }, { $set: { status: previous.status } });
      }
      throw seatsError(activeCount - 1, sub.seats);
    }
  }

  if (req) {
    await audit(req, {
      action: 'license.assigned',
      productKey,
      resource: 'license',
      resourceId: license._id,
      metadata: { userId: String(userId), subscriptionId: String(sub._id) },
    });
  }
  // Notification + email d'accès activé (selon préférences, best-effort).
  await notifyUser({
    tenantId,
    userId,
    event: 'license_assigned',
    productKey,
    params: { productKey },
    link: getProduct(productKey)?.route || product.route || '/workspace',
    emailParams: { productName: product.nameKey || product.name || productKey, link: getProduct(productKey)?.route || product.route || '/workspace' },
  });

  return { license, created: !previous, reactivated: !!previous && !wasActive };
}

/**
 * Garantit une licence active (provisionnement best-effort pour les flux
 * projet : ajout au projet, assignation de tâche). Ne notifie que lors d'un
 * provisionnement réel. Lève SEATS_EXCEEDED / NO_SUBSCRIPTION le cas échéant.
 */
async function ensureLicense({ tenantId, userId, productKey, assignedBy = null }, req = null) {
  const existing = await LicenseAssignment.findOne({ tenantId, userId, productKey, status: 'active' }).lean();
  if (existing) return { license: existing, provisioned: false };
  const { license } = await assignLicense({ tenantId, userId, productKey, assignedBy }, req);
  return { license, provisioned: true };
}

/** Réactive une licence suspendue (consomme un siège — même garde). */
async function reactivateLicense(licenseId, tenantId, req = null) {
  const existing = await LicenseAssignment.findOne({ _id: licenseId, tenantId });
  if (!existing) {
    const err = new Error('Licence introuvable.');
    err.code = 'LICENSE_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (existing.status === 'active') return { license: existing, reactivated: false };
  const sub = await grantingSubscription(tenantId, existing.productKey, existing.subscriptionId);
  if (sub) {
    const activeCount = await LicenseAssignment.countDocuments({ tenantId, productKey: existing.productKey, status: 'active' });
    if (activeCount >= sub.seats) throw seatsError(activeCount, sub.seats);
  }
  existing.status = 'active';
  await existing.save();
  if (req) {
    await audit(req, {
      action: 'license.activated',
      productKey: existing.productKey,
      resource: 'license',
      resourceId: existing._id,
      metadata: { userId: String(existing.userId) },
    });
  }
  const product = await Product.findOne({ key: existing.productKey }).lean();
  await notifyUser({
    tenantId,
    userId: existing.userId,
    event: 'license_assigned',
    productKey: existing.productKey,
    params: { productKey: existing.productKey },
    link: getProduct(existing.productKey)?.route || product?.route || '/workspace',
    emailParams: { productName: product?.nameKey || product?.name || existing.productKey, link: getProduct(existing.productKey)?.route || product?.route || '/workspace' },
  });
  return { license: existing, reactivated: true };
}

module.exports = { assignLicense, ensureLicense, reactivateLicense, grantingSubscription };

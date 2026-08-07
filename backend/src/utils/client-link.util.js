const { Client } = require('../models/client.model');

/**
 * Lien métier « compte Utilisateur (role=CLIENT) » ↔ « fiche Client ».
 *
 * Rappel d'architecture (voir models/user.model.js) :
 *   Client      = entité commerciale (contrats, coordonnées) — zéro auth.
 *   Utilisateur = identité & accès — zéro donnée commerciale.
 *   `Utilisateur.clientId` (ObjectId → Client) est la référence canonique :
 *   c'est lui qui détermine les contrats visibles par un compte CLIENT.
 *
 * Le rapprochement par email (même email dans le tenant) n'est conservé
 * qu'en REPLI pour les données historiques créées avant l'introduction du
 * lien explicite ; `backfillClientAccountLinks` les migre (idempotent).
 */

/**
 * Résout la fiche Client d'un compte portail :
 *  1. par `clientId` explicite (référence canonique, contrôlée tenant) ;
 *  2. à défaut, par email (repli legacy read-only — jamais d'écriture ici).
 * @param {ObjectId|string|null} tenantId tenant courant (req.tenantId)
 * @param {{ clientId?: any, email?: string }} compte infos minimales du compte
 * @returns {Promise<import('mongoose').Document|null>} la fiche ou null
 */
const resolveClientForUserAccount = async (tenantId, compte) => {
  if (!tenantId || !compte) return null;
  if (compte.clientId) {
    const client = await Client.findOne({ _id: compte.clientId, tenantId }).lean();
    if (client) return client;
    // clientId orphelin (fiche supprimée) : on tente le repli email ci-dessous
  }
  if (!compte.email) return null;
  return Client.findOne({ tenantId, email: compte.email }).lean();
};

/**
 * Renseigne `clientId` sur un document Utilisateur CLIENT si une fiche de
 * même email existe dans le tenant (création de compte, bascule de rôle).
 * Ne fait rien si un clientId explicite est déjà présent.
 */
const attachClientByEmail = async (tenantId, userDoc) => {
  if (!tenantId || !userDoc || userDoc.role !== 'CLIENT' || userDoc.clientId) return userDoc;
  const client = await Client.findOne({ tenantId, email: userDoc.email }).select('_id').lean();
  if (client) userDoc.clientId = client._id;
  return userDoc;
};

/**
 * Migration idempotente : rattache tous les comptes CLIENT sans clientId
 * à leur fiche de même email (dans leur tenant). Relançable sans risque ;
 * utilisée par le seed (données de démo) et `npm run migrate` (production).
 * @returns {Promise<number>} nombre de comptes rattachés
 */
const backfillClientAccountLinks = async () => {
  const { Utilisateur } = require('../models/user.model');
  const comptes = await Utilisateur.find({
    role: 'CLIENT',
    $or: [{ clientId: null }, { clientId: { $exists: false } }],
  }).select('tenantId email clientId');

  let lies = 0;
  for (const compte of comptes) {
    if (!compte.tenantId) continue;
    const client = await Client.findOne({ tenantId: compte.tenantId, email: compte.email }).select('_id').lean();
    if (!client) continue;
    compte.clientId = client._id;
    await compte.save();
    lies += 1;
  }
  return lies;
};

module.exports = { resolveClientForUserAccount, attachClientByEmail, backfillClientAccountLinks };

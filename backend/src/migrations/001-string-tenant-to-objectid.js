/**
 * Migration : "tenant-as-string" -> "Tenant ObjectId ref".
 *
 * Contexte : avant cette migration, `tenantId` était une simple chaîne
 * libre (ex: "tenant-001") dupliquée sur chaque collection métier. Cette
 * migration :
 *   1. Recense toutes les valeurs de tenantId (String) présentes dans les
 *      collections utilisateurs/clients/contrats/demandes/changements.
 *   2. Crée un document Tenant réel pour chacune (voir MAPPING ci-dessous
 *      pour donner un nom lisible aux anciens identifiants connus —
 *      "tenant-001" devient le Tenant "Fluidity", conformément à la
 *      consigne de migration : "Map existing Fluidity data into a Tenant
 *      called: Fluidity").
 *   3. Réécrit `tenantId` sur chaque document concerné, de la chaîne
 *      d'origine vers l'ObjectId du nouveau Tenant.
 *
 * Idempotent : si `tenantId` est déjà un ObjectId valide sur un document,
 * il est laissé tel quel (la migration peut être relancée sans risque).
 *
 * IMPORTANT : à exécuter UNE SEULE FOIS, sur une base contenant encore des
 * tenantId au format chaîne (ancien schéma, avant le commit "ObjectId
 * refactor"). Aucune donnée métier n'est supprimée ; seule la valeur du
 * champ tenantId est réécrite.
 *
 * Usage :
 *   node src/migrations/001-string-tenant-to-objectid.js
 *
 * Variante "dry-run" (n'écrit rien, affiche seulement ce qui serait fait) :
 *   node src/migrations/001-string-tenant-to-objectid.js --dry-run
 */

const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { Tenant } = require('../models/tenant.model');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Demande } = require('../models/demande.model');
const { Changement } = require('../models/changement.model');

const DRY_RUN = process.argv.includes('--dry-run');

/** Nom lisible à donner à un ancien identifiant de tenant (chaîne) connu. */
const KNOWN_TENANT_NAMES = {
  'tenant-001': 'Fluidity',
  'tenant-002': 'Northwind Digital',
};

const COLLECTIONS = [
  { model: Utilisateur, label: 'utilisateurs' },
  { model: Client, label: 'clients' },
  { model: Contrat, label: 'contrats' },
  { model: Demande, label: 'demandes' },
  { model: Changement, label: 'changements' },
];

/** true si la valeur ressemble déjà à un ObjectId Mongo valide (migration déjà faite). */
function isAlreadyObjectId(value) {
  return mongoose.isValidObjectId(value) && String(new mongoose.Types.ObjectId(value)) === String(value);
}

async function run() {
  await connectDB();
  console.log(`[Migration] Démarrage${DRY_RUN ? ' (mode dry-run — aucune écriture)' : ''}...`);

  // Étape 1 : recenser toutes les valeurs distinctes de tenantId encore au format chaîne
  const legacyTenantIds = new Set();
  for (const { model, label } of COLLECTIONS) {
    // Requête volontairement "brute" ($type: 'string') pour ne cibler que
    // les documents pas encore migrés, quel que soit le typage Mongoose
    // courant du champ.
    const rawIds = await model.collection.distinct('tenantId', { tenantId: { $type: 'string' } });
    rawIds.forEach((id) => legacyTenantIds.add(id));
    console.log(`[Migration] ${label} : ${rawIds.length} valeur(s) de tenantId (String) trouvée(s).`);
  }

  if (legacyTenantIds.size === 0) {
    console.log('[Migration] Aucun tenantId au format chaîne trouvé — rien à migrer (déjà à jour, ou base vide).');
    await mongoose.disconnect();
    return;
  }

  // Étape 2 : créer (ou retrouver) un Tenant réel pour chaque ancien identifiant
  const tenantIdMap = new Map(); // ancien tenantId (String) -> nouveau _id (ObjectId)

  for (const legacyId of legacyTenantIds) {
    const name = KNOWN_TENANT_NAMES[legacyId] || `Tenant migré (${legacyId})`;
    const slug = (KNOWN_TENANT_NAMES[legacyId] || `migrated-${legacyId}`)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let tenant = await Tenant.findOne({ slug });
    if (!tenant) {
      console.log(`[Migration] Création du Tenant "${name}" (slug: ${slug}) pour l'ancien tenantId "${legacyId}"...`);
      if (!DRY_RUN) {
        tenant = await Tenant.create({
          name,
          slug,
          type: 'Company',
          email: `contact@${slug}.dev`,
          plan: 'Business',
          status: 'Active',
          maxUsers: 50, // généreux par défaut ; à ajuster manuellement après migration
        });
      } else {
        tenant = { _id: new mongoose.Types.ObjectId() }; // id factice pour la simulation
      }
    } else {
      console.log(`[Migration] Tenant "${name}" (slug: ${slug}) déjà existant, réutilisé.`);
    }
    tenantIdMap.set(legacyId, tenant._id);
  }

  // Étape 3 : réécrire tenantId sur chaque collection, ancien -> nouveau
  for (const { model, label } of COLLECTIONS) {
    let updated = 0;
    for (const [legacyId, newTenantId] of tenantIdMap) {
      if (isAlreadyObjectId(legacyId)) continue; // déjà migré, rien à faire

      const filter = { tenantId: legacyId };
      const count = await model.collection.countDocuments(filter);
      if (count === 0) continue;

      console.log(`[Migration] ${label} : ${count} document(s) avec tenantId="${legacyId}" -> ${newTenantId}`);
      if (!DRY_RUN) {
        const res = await model.collection.updateMany(filter, { $set: { tenantId: newTenantId } });
        updated += res.modifiedCount;
      } else {
        updated += count;
      }
    }
    console.log(`[Migration] ${label} : ${updated} document(s) mis à jour.`);
  }

  console.log(`[Migration] Terminée${DRY_RUN ? ' (dry-run — rien n\'a été écrit)' : ' avec succès'}.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('[Migration] Échec :', err);
  await mongoose.disconnect();
  process.exitCode = 1;
});

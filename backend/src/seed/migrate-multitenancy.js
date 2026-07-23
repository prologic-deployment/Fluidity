/**
 * Migration multi-tenant — convertit les données historiques (modèle
 * « mono-entreprise » : tenantId String, clientId = email, contrat =
 * référence texte, rôles legacy) vers le modèle SaaS normalisé :
 *
 *   tenantId String  -> ObjectId réf. Tenant (tenant-001 => « Fluidity »)
 *   rôles legacy     -> RBAC plateforme (voir LEGACY_ROLE_MAP)
 *   Demande/Changement.clientId (email) -> requester (ObjectId Utilisateur)
 *   Demande/Changement.contrat (réf.)   -> ObjectId Contrat
 *   Contrat.clientId (email)            -> ObjectId Client
 *
 * Le script est IDEMPOTENT : chaque document déjà migré est ignoré.
 * Aucune donnée n'est perdue — uniquement des conversions in-place.
 *
 * Usage : npm run migrate
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { Tenant } = require('../models/tenant.model');
const { LEGACY_ROLE_MAP } = require('../models/user.model');

/** tenantId historiques -> tenant SaaS (création si absent). */
const LEGACY_TENANT_NAMES = {
  'tenant-001': {
    name: 'Fluidity',
    contactEmail: 'contact@fluidity.dev',
    plan: 'Enterprise',
    maxUsers: 50,
    storageQuotaMb: 5120,
  },
  'tenant-002': {
    name: 'Nova Systems',
    contactEmail: 'contact@nova-systems.dev',
    plan: 'Professional',
    maxUsers: 20,
    storageQuotaMb: 2048,
  },
};

const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

/** Assure l'existence d'un tenant SaaS pour chaque tenantId String legacy. */
const ensureLegacyTenants = async (db) => {
  const collections = ['utilisateurs', 'clients', 'contrats', 'demandes', 'changements'];
  const legacyIds = new Set();
  for (const col of collections) {
    const docs = await db.collection(col).find({ tenantId: { $type: 'string' } }).project({ tenantId: 1 }).toArray();
    for (const d of docs) {
      if (d.tenantId && !isObjectIdString(d.tenantId)) legacyIds.add(d.tenantId);
    }
  }

  const map = {}; // legacyId -> ObjectId
  for (const legacyId of legacyIds) {
    const def = LEGACY_TENANT_NAMES[legacyId] || {
      name: `Tenant ${legacyId}`,
      contactEmail: undefined,
      plan: 'Free',
      maxUsers: 10,
      storageQuotaMb: 1024,
    };
    let tenant = await Tenant.findOne({ name: def.name });
    if (!tenant) {
      tenant = await new Tenant({ ...def, type: 'Company', status: 'active' }).save();
      console.log(`[Migration] Tenant créé : « ${def.name} » (depuis « ${legacyId} »)`);
    }
    map[legacyId] = tenant._id;
  }
  return map;
};

/** Convertit les tenantId String -> ObjectId dans une collection donnée. */
const convertTenantIds = async (db, collection, map) => {
  let converted = 0;
  for (const [legacyId, objectId] of Object.entries(map)) {
    const res = await db.collection(collection).updateMany({ tenantId: legacyId }, { $set: { tenantId: objectId } });
    converted += res.modifiedCount;
  }
  console.log(`[Migration] ${collection} : ${converted} document(s) rattaché(s) à un Tenant ObjectId.`);
};

/** Rôles legacy -> nouveaux rôles + valeurs par défaut (statut, département). */
const migrateUsers = async (db) => {
  let roles = 0, defaults = 0;
  for (const [legacy, nouveau] of Object.entries(LEGACY_ROLE_MAP)) {
    const res = await db.collection('utilisateurs').updateMany({ role: legacy }, { $set: { role: nouveau } });
    roles += res.modifiedCount;
  }
  const res = await db
    .collection('utilisateurs')
    .updateMany({ status: { $exists: false } }, { $set: { status: 'active', department: '' } });
  defaults += res.modifiedCount;
  console.log(`[Migration] utilisateurs : ${roles} rôle(s) converti(s), ${defaults} compte(s) initialisé(s).`);
};

/** Contrat.clientId (email) -> ObjectId du Client correspondant dans le tenant. */
const migrateContrats = async (db) => {
  let converted = 0, unresolved = 0;
  const clients = await db.collection('clients').find({}).toArray();
  const byTenantEmail = new Map(clients.map((c) => [`${c.tenantId}:${c.email}`, c._id]));

  const contrats = await db.collection('contrats').find({ clientId: { $type: 'string' } }).toArray();
  for (const c of contrats) {
    if (isObjectIdString(c.clientId)) continue;
    const id = byTenantEmail.get(`${c.tenantId}:${c.clientId}`);
    if (id) {
      await db.collection('contrats').updateOne({ _id: c._id }, { $set: { clientId: id } });
      converted++;
    } else {
      unresolved++;
      console.warn(`[Migration] contrat ${c.reference} : client « ${c.clientId} » introuvable — champ conservé.`);
    }
  }
  console.log(`[Migration] contrats : ${converted} clientId -> ObjectId (${unresolved} non résolu(s)).`);
};

/** Demande/Changement : clientId (email) -> requester ; contrat (référence) -> ObjectId. */
const migrateDossiers = async (db, collection) => {
  let requesters = 0, contrats = 0, unresolved = 0;
  const users = await db.collection('utilisateurs').find({}).toArray();
  const userByTenantEmail = new Map(users.map((u) => [`${u.tenantId}:${u.email}`, u._id]));
  const contratDocs = await db.collection('contrats').find({}).toArray();
  const contratByTenantRef = new Map(contratDocs.map((c) => [`${c.tenantId}:${c.reference}`, c._id]));

  const docs = await db.collection(collection).find({ $or: [{ clientId: { $exists: true } }, { contrat: { $type: 'string' } }] }).toArray();
  for (const d of docs) {
    const set = {};
    const unset = {};
    if (typeof d.clientId === 'string' && d.clientId) {
      const id = userByTenantEmail.get(`${d.tenantId}:${d.clientId}`);
      if (id) {
        set.requester = id;
        unset.clientId = '';
        requesters++;
      } else {
        unresolved++;
        console.warn(`[Migration] ${collection} ${d._id} : demandeur « ${d.clientId} » introuvable — document incomplet.`);
      }
    }
    if (typeof d.contrat === 'string' && d.contrat && !isObjectIdString(d.contrat)) {
      const id = contratByTenantRef.get(`${d.tenantId}:${d.contrat}`);
      if (id) {
        set.contrat = id;
        contrats++;
      } else {
        unresolved++;
        console.warn(`[Migration] ${collection} ${d._id} : contrat « ${d.contrat} » introuvable — champ conservé.`);
      }
    }
    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(update).length) {
      await db.collection(collection).updateOne({ _id: d._id }, update);
    }
  }
  console.log(`[Migration] ${collection} : ${requesters} requester, ${contrats} contrat(s) -> ObjectId (${unresolved} non résolu(s)).`);
};

/** Exécute la migration complète (idempotente). Renvoie le résumé par tenant. */
const migrateToMultiTenancy = async () => {
  const db = mongoose.connection.db;
  console.log('[Migration] === Début de la migration multi-tenant ===');
  const map = await ensureLegacyTenants(db);
  if (Object.keys(map).length === 0) {
    console.log('[Migration] Aucune donnée legacy à convertir (déjà à jour ou base vide).');
  }
  for (const col of ['utilisateurs', 'clients', 'contrats', 'demandes', 'changements']) {
    await convertTenantIds(db, col, map);
  }
  await migrateUsers(db);
  await migrateContrats(db);
  await migrateDossiers(db, 'demandes');
  await migrateDossiers(db, 'changements');
  console.log('[Migration] === Migration multi-tenant terminée ===');
  return map;
};

// Exécution autonome : npm run migrate
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await migrateToMultiTenancy();
    } catch (err) {
      console.error('[Migration] Échec :', err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { migrateToMultiTenancy };

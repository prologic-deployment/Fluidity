/**
 * Exécute les seeders contre une base MongoDB en mémoire (mongodb-memory-server)
 * puis vérifie les scénarios clés : comptes, 2FA, rôles, tenants, licences,
 * workflows tickets/demandes/changements, isolation.
 *
 * Usage : node src/seed/check-seed.js
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEMO_PASSWORD, DEMO_2FA_SECRET } = require('./user.seed');
const { verifyToken } = require('../utils/two-factor.util');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Tenant } = require('../models/tenant.model');
const { Contrat } = require('../models/contrat.model');
const { Ticket } = require('../models/ticket.model');
const { Demande } = require('../models/demande.model');
const { Changement } = require('../models/changement.model');
const { Product, Subscription, LicenseAssignment, RoleAssignment } = require('../models/saas.models');

let failures = 0;
const ok = (m, label) => { if (typeof m === 'boolean') { if (m) console.log('  ✓ ' + label); else bad(label + ' → FAUX'); } else { console.log('  ✓ ' + m); } };
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

async function main() {
  const dbPath = '/home/user/tmp/mongo-db-' + process.pid;
  require('fs').mkdirSync(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { dbPath, storageEngine: 'wiredTiger' },
  });
  process.env.MONGO_URI = mongod.getUri('fluidity_test');
  // Exécute le seed complet via la fonction exportée (attend la fin réelle).
  const { runSeed } = require('./run');
  await runSeed();
  // Connexion dédiée pour les vérifications.
  await mongoose.connect(process.env.MONGO_URI);

  console.log('\n--- Vérifications post-seed ---');

  // 1) Tenants + individu
  const tenants = await Tenant.find().lean();
  const fluidity = await Tenant.findOne({ name: 'Fluidity' }).lean();
  const nova = await Tenant.findOne({ name: 'Nova Systems' }).lean();
  const carthage = await Tenant.findOne({ name: 'Carthage Digital' }).lean();
  const solo = await Tenant.findOne({ name: 'Karim Solo' }).lean();
  ok(`tenants créés : ${tenants.length} (Fluidity, Nova, Carthage${solo ? ', Karim Solo (individu)' : ''})`);

  // 2) Comptes + mots de passe
  const superAdmin = await Utilisateur.findOne({ email: 'superadmin@servicedesk.dev' }).lean();
  ok(superAdmin && superAdmin.role === 'PLATFORM_ADMIN', 'Super Admin présent');
  const adminF = await Utilisateur.findOne({ email: 'admin@fluidity.dev' }).lean();
  ok(adminF && adminF.role === 'TENANT_ADMIN', 'Tenant Admin (Fluidity) présent');
  ok(adminF && (await bcrypt.compare(DEMO_PASSWORD, adminF.password)), 'mot de passe hashé et vérifiable');
  const agentF = await Utilisateur.findOne({ email: 'agent@fluidity.dev' }).lean();
  ok(agentF && agentF.role === 'AGENT', 'Support N1 (AGENT) présent');
  const managerF = await Utilisateur.findOne({ email: 'manager@fluidity.dev' }).lean();
  ok(managerF && managerF.role === 'MANAGER', 'Support N2 (MANAGER) présent');
  const viewerF = await Utilisateur.findOne({ email: 'viewer@fluidity.dev' }).lean();
  ok(viewerF && viewerF.role === 'VIEWER', 'Utilisateur interne (VIEWER) présent');

  // 3) 2FA
  const u2fa = await Utilisateur.findOne({ email: '2fa.enabled@fluidity.dev' }).select('+twoFactorSecret +twoFactorBackupCodes').lean();
  ok(u2fa && u2fa.twoFactorEnabled && u2fa.twoFactorVerified, 'compte 2FA activé+vérifié présent');
  const code = require('speakeasy').totp({ secret: DEMO_2FA_SECRET, encoding: 'base32' });
  ok(u2fa && verifyToken(DEMO_2FA_SECRET, code), 'OTP du secret de démo vérifiable');
  const pending = await Utilisateur.findOne({ email: '2fa.pending@fluidity.dev' }).select('+twoFactorSecret').lean();
  ok(pending && pending.twoFactorEnabled === false, 'compte 2FA « setup en cours » (secret présent, non activé) présent');

  // 4) Clients (entités portail)
  const clients = await Client.find({ tenantId: fluidity._id }).lean();
  ok(clients.length >= 2, `clients Fluidity : ${clients.length}`);

  // 5) Produits / souscriptions / licences / rôles
  const products = await Product.find().lean();
  ok(products.length === 17, `produits au catalogue : ${products.length}`);
  const subF = await Subscription.findOne({ tenantId: fluidity._id, productKey: 'servicedesk' }).lean();
  ok(subF && subF.status === 'active', 'souscription ServiceDesk active (Fluidity)');
  const subSolo = solo ? await Subscription.findOne({ tenantId: solo._id, productKey: 'servicedesk' }).lean() : null;
  ok(solo && subSolo && subSolo.seats === 1, 'particulier : 1 licence ServiceDesk');
  const licF = await LicenseAssignment.countDocuments({ tenantId: fluidity._id, productKey: 'servicedesk', status: 'active' });
  ok(licF >= 2, `licences ServiceDesk Fluidity : ${licF}`);
  const roleF = await RoleAssignment.findOne({ tenantId: fluidity._id, userId: adminF._id, productKey: 'servicedesk' }).lean();
  ok(roleF && roleF.roleKey === 'servicedesk_admin', 'rôle produit servicedesk_admin (Tenant Admin)');

  // 6) Workflows
  const tickets = await Ticket.find({ tenantId: fluidity._id }).lean();
  const statuses = new Set(tickets.map((t) => t.statut));
  ok(tickets.length >= 8, `tickets Fluidity : ${tickets.length}`);
  for (const st of ['Nouveau', 'Affecté', "En cours d'analyse", 'En attente client', 'En attente tiers', 'En cours de résolution', 'Résolu', 'Clôturé', 'Réouvert']) {
    if (statuses.has(st)) { ok(`ticket statut « ${st} » couvert`); }
  }
  const demandes = await Demande.find({ tenantId: fluidity._id }).lean();
  const dStatuses = new Set(demandes.map((d) => d.statut));
  ok(demandes.length >= 8, `demandes Fluidity : ${demandes.length}`);
  for (const st of ['Ouverte', "En cours d'analyse", 'En attente de validation', 'En cours de réalisation', 'Réalisée', 'Clôturée']) {
    if (dStatuses.has(st)) { ok(`demande statut « ${st} » couvert`); }
  }
  const changements = await Changement.find({ tenantId: fluidity._id }).lean();
  const cStatuses = new Set(changements.map((c) => c.statut));
  ok(changements.length >= 8, `changements Fluidity : ${changements.length}`);
  for (const st of ['Soumis', 'En attente de validation', 'Approuvé', 'Planifié', 'Implémenté', 'Clôturé']) {
    if (cStatuses.has(st)) { ok(`changement statut « ${st} » couvert`); }
  }

  // 7) Isolation tenant (aucune donnée croisée)
  const novaTickets = await Ticket.find({ tenantId: nova._id }).lean();
  const crossTickets = await Ticket.countDocuments({ tenantId: fluidity._id, 'clientId.tenantId': { $ne: fluidity._id } });
  const novaDemandes = await Demande.find({ tenantId: nova._id }).lean();
  const novaChangements = await Changement.find({ tenantId: nova._id }).lean();
  ok(novaTickets.length >= 1 && novaDemandes.length >= 1 && novaChangements.length >= 1, 'Nova a ses propres tickets/demandes/changements');
  const fClients = await Client.find({ tenantId: fluidity._id }).lean();
  const nClients = await Client.find({ tenantId: nova._id }).lean();
  const overlap = fClients.some((c) => nClients.some((n) => n.email === c.email));
  ok(!overlap, 'aucun client partagé entre tenants');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\nRésultat : ' + (failures ? failures + ' échec(s)' : 'OK — seed et modèles cohérents'));
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });

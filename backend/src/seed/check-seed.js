/**
 * Vérification automatisée du seed : exécute le seed contre une base MongoDB
 * en mémoire (mongodb-memory-server) et vérifie l'intégrité des données.
 * Usage : node src/seed/check-seed.js
 */
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'seed_check_secret';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY || 'seed_check_2fa_key_123456789012345678901234';

  const { runSeed } = require('./run.js');
  await runSeed();

  // runSeed() se déconnecte en fin d'exécution : on se reconnecte pour vérifier.
  await mongoose.connect(process.env.MONGO_URI);

  const { Utilisateur } = require('../models/user.model');
  const { Client } = require('../models/client.model');
  const { Contrat } = require('../models/contrat.model');
  const { Demande } = require('../models/demande.model');
  const { Changement } = require('../models/changement.model');
  const { Ticket } = require('../models/ticket.model');
  const { LoginActivity } = require('../models/login-activity.model');

  // --- Utilisateurs & rôles ---
  const users = await Utilisateur.find();
  assert.ok(users.length >= 9, `Utilisateurs insuffisants (${users.length})`);
  const roles = new Set(users.map((u) => u.role));
  for (const r of ['ADMIN', 'CLIENT', 'SUPPORT_N1', 'RESPONSABLE_TECHNIQUE', 'COMMERCIAL', 'EXPLOITATION']) {
    assert.ok(roles.has(r), `Rôle manquant : ${r}`);
  }
  // Aucun tenantId résiduel
  for (const u of users) assert.strictEqual(u.tenantId, undefined, 'tenantId résiduel sur un utilisateur');

  // --- 2FA ---
  const enabled = await Utilisateur.findOne({ email: '2fa.enabled@fluidity.dev' }).select('+twoFactorSecret +twoFactorBackupCodes');
  assert.ok(enabled, 'Compte 2FA enabled absent');
  assert.strictEqual(enabled.twoFactorEnabled, true, '2FA enabled != true');
  assert.strictEqual(enabled.twoFactorVerified, true);
  assert.ok(enabled.twoFactorSecret && enabled.twoFactorSecret.startsWith('v1.'), 'Secret 2FA non chiffré (attendu v1.…)');
  assert.ok(enabled.twoFactorBackupCodes.length === 5, 'Codes de secours manquants');

  const pending = await Utilisateur.findOne({ email: '2fa.pending@fluidity.dev' }).select('+twoFactorSecret');
  assert.ok(pending, 'Compte 2FA pending absent');
  assert.strictEqual(pending.twoFactorEnabled, false, '2FA pending ne doit pas être activée');

  // --- Clients & contrats (ObjectId) ---
  const clients = await Client.find();
  assert.strictEqual(clients.length, 2, 'Clients manquants');
  const contrats = await Contrat.find();
  assert.ok(contrats.length >= 3, 'Contrats manquants');
  for (const c of contrats) {
    assert.ok(mongoose.isValidObjectId(c.clientId), 'clientId contrat non ObjectId');
  }

  // --- Demandes ---
  const demandes = await Demande.find();
  assert.ok(demandes.length >= 4, 'Demandes manquantes');
  const dStatuses = new Set(demandes.map((d) => d.statut));
  assert.ok(['Ouverte', "En cours d'analyse", 'Réalisée', 'En attente de validation'].every((s) => dStatuses.has(s)), 'Statuts de demandes incomplets');
  for (const d of demandes) {
    assert.ok(mongoose.isValidObjectId(d.clientId), 'clientId demande non ObjectId');
    assert.ok(mongoose.isValidObjectId(d.contrat), 'contrat demande non ObjectId');
    assert.ok(mongoose.isValidObjectId(d.requester), 'requester demande non ObjectId');
  }

  // --- Changements ---
  const changements = await Changement.find();
  assert.ok(changements.length >= 5, 'Changements manquants');
  for (const ch of changements) {
    assert.ok(mongoose.isValidObjectId(ch.clientId), 'clientId changement non ObjectId');
    assert.ok(mongoose.isValidObjectId(ch.contrat), 'contrat changement non ObjectId');
  }
  const cStatuses = new Set(changements.map((c) => c.statut));
  assert.ok(['Soumis', 'Planifié', 'Approuvé', 'Clôturé', "En cours d'implémentation"].every((s) => cStatuses.has(s)), 'Statuts de changements incomplets');

  // --- Tickets : impacts/urgences/priorités/statuts ---
  const tickets = await Ticket.find();
  assert.ok(tickets.length >= 9, 'Tickets manquants');
  const impacts = new Set(tickets.map((t) => t.impact));
  assert.deepStrictEqual([...impacts].sort(), ['Critique', 'Faible', 'Moyen', 'Élevé'].sort(), 'Impacts incomplets');
  const urgences = new Set(tickets.map((t) => t.urgence));
  assert.deepStrictEqual([...urgences].sort(), ['Critique', 'Faible', 'Moyenne', 'Élevée'].sort(), 'Urgences incomplètes');
  const priorites = new Set(tickets.map((t) => t.priorite));
  assert.deepStrictEqual([...priorites].sort(), ['P1', 'P2', 'P3', 'P4'].sort(), 'Priorités incomplètes');
  const tStatuses = new Set(tickets.map((t) => t.statut));
  for (const s of ['Nouveau', 'Affecté', "En cours d'analyse", 'En attente client', 'En attente tiers', 'En cours de résolution', 'Résolu', 'Clôturé', 'Réouvert']) {
    assert.ok(tStatuses.has(s), `Statut ticket manquant : ${s}`);
  }
  for (const t of tickets) {
    assert.strictEqual(t.type, 'Incident', 'type ticket != Incident');
    assert.ok(t.reference.startsWith('INC-'), 'Référence ticket invalide');
    assert.ok(mongoose.isValidObjectId(t.clientId), 'clientId ticket non ObjectId');
    assert.ok(mongoose.isValidObjectId(t.contrat), 'contrat ticket non ObjectId');
  }

  // --- Priorité recalculée côté serveur (cohérence matrice) ---
  const { calculatePriority } = require('../utils/ticket-priority');
  for (const t of tickets) {
    assert.strictEqual(t.priorite, calculatePriority(t.impact, t.urgence), `Priorité incohérente sur ${t.reference}`);
  }

  // --- Activité de connexion ---
  const activity = await LoginActivity.countDocuments();
  assert.ok(activity >= 3, `Activité de connexion insuffisante (${activity})`);

  console.log('[check-seed] TOUTES LES VÉRIFICATIONS SONT PASSÉES.');
  console.log(`[check-seed] ${users.length} utilisateurs, ${clients.length} clients, ${contrats.length} contrats, ${demandes.length} demandes, ${changements.length} changements, ${tickets.length} tickets, ${activity} événements d'activité.`);

  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('[check-seed] ÉCHEC :', err);
  process.exit(1);
});

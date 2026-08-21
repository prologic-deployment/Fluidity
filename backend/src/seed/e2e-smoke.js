/**
 * Test de bout-en-bout (smoke) : authentification, 2FA, profil, mot de passe,
 * demandes, changements et tickets — contre une base MongoDB en mémoire.
 * Usage : node src/seed/e2e-smoke.js
 */
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const speakeasy = require('speakeasy');

const BASE = 'http://127.0.0.1:3210/api';

async function request(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'e2e_jwt_secret_123';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e_2fa_key_123456789012345678901234567890';

  const { runSeed } = require('./run.js');
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);

  const app = require('../app.js');
  const server = app.listen(3210);
  await new Promise((r) => server.on('listening', r));

  const log = (msg) => console.log('  ✓', msg);

  // --- 1. Connexion sans 2FA ---
  let r = await request('POST', '/auth/login', { body: { email: 'admin@fluidity.dev', password: 'Password123!' } });
  assert.strictEqual(r.status, 200, 'login admin');
  assert.ok(r.json.token && !r.json.requiresTwoFactor, 'admin : session directe attendue');
  const adminToken = r.json.token;
  log('Login sans 2FA (admin)');

  // --- 2. Profil ---
  r = await request('GET', '/auth/me', { token: adminToken });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.email, 'admin@fluidity.dev');
  log('GET /auth/me');

  r = await request('PATCH', '/auth/profile', { token: adminToken, body: { firstName: 'Leila', jobTitle: 'Directrice' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.user.firstName, 'Leila');
  log('PATCH /auth/profile');

  // --- 3. Changement de mot de passe ---
  r = await request('POST', '/auth/change-password', {
    token: adminToken,
    body: { currentPassword: 'Password123!', newPassword: 'Nouveau123!', confirmation: 'Nouveau123!' },
  });
  assert.strictEqual(r.status, 200, `change password: ${JSON.stringify(r.json)}`);
  // puis reconnexion avec le nouveau mot de passe
  r = await request('POST', '/auth/login', { body: { email: 'admin@fluidity.dev', password: 'Nouveau123!' } });
  assert.strictEqual(r.status, 200);
  // remettre le mot de passe d'origine pour la suite
  await request('POST', '/auth/change-password', {
    token: r.json.token,
    body: { currentPassword: 'Nouveau123!', newPassword: 'Password123!', confirmation: 'Password123!' },
  });
  log('Changement de mot de passe + reconnexion');

  // --- 4. 2FA : activation (support) ---
  r = await request('POST', '/auth/login', { body: { email: 'support@fluidity.dev', password: 'Password123!' } });
  assert.strictEqual(r.status, 200);
  const supportToken = r.json.token;

  r = await request('GET', '/auth/2fa/status', { token: supportToken });
  assert.strictEqual(r.json.enabled, false);
  log('2FA status (désactivé)');

  r = await request('POST', '/auth/2fa/setup', { token: supportToken });
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.qrCode && r.json.qrCode.startsWith('data:image/png'), 'QR code manquant');
  assert.ok(r.json.manualKey, 'clé manuelle manquante');
  const manualKey = r.json.manualKey;
  log('2FA setup (QR + clé manuelle)');

  // code TOTP valide
  const otp = speakeasy.totp({ secret: manualKey, encoding: 'base32' });
  r = await request('POST', '/auth/2fa/verify-setup', { token: supportToken, body: { code: otp } });
  assert.strictEqual(r.status, 200, `verify-setup: ${JSON.stringify(r.json)}`);
  assert.ok(r.json.backupCodes && r.json.backupCodes.length === 10, 'codes de secours manquants');
  log('2FA verify-setup (activation + 10 codes de secours)');

  // --- 5. 2FA : connexion avec challenge ---
  r = await request('POST', '/auth/login', { body: { email: 'support@fluidity.dev', password: 'Password123!' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.requiresTwoFactor, true, 'challenge 2FA attendu');
  assert.ok(r.json.twoFactorToken, 'jeton temporaire manquant');
  assert.strictEqual(r.json.token, undefined, 'aucune session ne doit être émise');
  const twoFactorToken = r.json.twoFactorToken;
  log('Login 2FA → challenge (pas de session)');

  // mauvais code → refus
  r = await request('POST', '/auth/2fa/verify-login', { body: { twoFactorToken, code: '000000' } });
  assert.strictEqual(r.status, 401, 'code invalide doit être refusé');
  // bon code
  const otp2 = speakeasy.totp({ secret: manualKey, encoding: 'base32' });
  r = await request('POST', '/auth/2fa/verify-login', { body: { twoFactorToken, code: otp2 } });
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.token, 'session attendue après 2FA');
  log('2FA verify-login (session émise)');

  // --- 6. 2FA : désactivation ---
  r = await request('POST', '/auth/2fa/disable', { token: supportToken, body: { password: 'Password123!' } });
  assert.strictEqual(r.status, 200, `disable: ${JSON.stringify(r.json)}`);
  log('2FA disable (mot de passe)');

  // --- 7. Demande (client) ---
  r = await request('POST', '/auth/login', { body: { email: 'client@fluidity.dev', password: 'Password123!' } });
  const clientToken = r.json.token;
  const { Contrat } = require('../models/contrat.model');
  const ctr = await Contrat.findOne({ reference: 'CTR-2026-001' });
  r = await request('POST', '/demandes', {
    token: clientToken,
    body: {
      objet: 'Test e2e demande', typeDemande: 'Support technique', serviceEnvironnement: 'Test',
      categorie: 'Réseau', sousCategorie: 'VLAN', descriptionDetaillee: 'Demande de test bout-en-bout.',
      prioriteSouhaitee: 'Standard', contrat: ctr._id.toString(),
    },
  });
  assert.strictEqual(r.status, 201, `create demande: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.statut, 'Ouverte');
  log('Création de demande (CLIENT)');

  // --- 8. Changement (client) ---
  r = await request('POST', '/changements', {
    token: clientToken,
    body: {
      objetChangement: 'Test e2e changement', descriptionDetaillee: 'Changement de test bout-en-bout.',
      serviceEnvironnement: 'Test', categorie: 'Stockage', sousCategorie: 'Extension capacité',
      planRetourArriere: 'Réversible.', typeChangement: 'Standard', contrat: ctr._id.toString(),
      specifications: { stockage: [{ typeStockage: 'NAS', protocole: 'NFS', capaciteGo: 100 }] },
    },
  });
  assert.strictEqual(r.status, 201, `create changement: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.statut, 'Soumis');
  log('Création de changement (CLIENT) + spécifications stockage');

  // --- 9. Ticket / incident (client) ---
  r = await request('POST', '/tickets', {
    token: clientToken,
    body: {
      objet: 'Test e2e incident', descriptionDetaillee: 'Incident de test bout-en-bout avec assez de texte.',
      categorie: 'Réseau', sousCategorie: 'VPN', impact: 'Critique', urgence: 'Critique',
      contrat: ctr._id.toString(),
    },
  });
  assert.strictEqual(r.status, 201, `create ticket: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.type, 'Incident');
  assert.strictEqual(r.json.priorite, 'P1', 'Critique × Critique doit donner P1');
  assert.strictEqual(r.json.statut, 'Nouveau');
  const ticketId = r.json._id;
  log('Création de ticket (Incident) + priorité P1 calculée');

  // --- 10. Workflow ticket : affectation + transition ---
  r = await request('GET', '/tickets/assignees', { token: adminToken });
  assert.strictEqual(r.status, 200);
  const support = r.json.find((u) => u.role === 'SUPPORT_N1');

  r = await request('PATCH', `/tickets/${ticketId}/assigner`, {
    token: adminToken,
    body: { assignedTeam: 'Réseau', assignedTo: support ? support._id : null },
  });
  assert.strictEqual(r.status, 200, `assigner: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.statut, 'Affecté', 'affectation doit faire passer Nouveau → Affecté');
  log('Affectation ticket (Nouveau → Affecté)');

  r = await request('PATCH', `/tickets/${ticketId}/statut`, { token: adminToken, body: { statut: "En cours d'analyse" } });
  assert.strictEqual(r.status, 200);
  r = await request('PATCH', `/tickets/${ticketId}/statut`, { token: adminToken, body: { statut: 'En cours de résolution' } });
  assert.strictEqual(r.status, 200);
  r = await request('PATCH', `/tickets/${ticketId}/statut`, { token: adminToken, body: { statut: 'Résolu', resume: 'Résolution de test' } });
  assert.strictEqual(r.status, 200, `resoudre: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.statut, 'Résolu');
  // transition illégale → refus
  r = await request('PATCH', `/tickets/${ticketId}/statut`, { token: clientToken, body: { statut: 'Nouveau' } });
  assert.strictEqual(r.status, 403, 'transition illégale (client) doit être refusée');
  // clôture par le client
  r = await request('PATCH', `/tickets/${ticketId}/statut`, { token: clientToken, body: { statut: 'Clôturé' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.statut, 'Clôturé');
  log('Workflow ticket complet (Résolu → Clôturé) + transition illégale refusée');

  // --- 11. Transition demande illégale refusée ---
  const { Demande } = require('../models/demande.model');
  const d = await Demande.findOne({ objet: 'Test e2e demande' });
  r = await request('PATCH', `/demandes/${d._id}/statut`, { token: clientToken, body: { statut: 'Réalisée' } });
  assert.strictEqual(r.status, 403, 'un CLIENT ne peut pas passer une demande en Réalisée');
  log('Workflow demande : transition illégale refusée (CLIENT)');

  // --- 12. Activité de connexion ---
  r = await request('GET', '/auth/login-activity', { token: adminToken });
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.activites), 'activités attendues');
  log(`Activité de connexion (${r.json.activites.length} événements)`);

  // --- 13. Client = accès portail Client (modèle Client, plus de rôle Utilisateur) ---
  r = await request('GET', '/auth/me', { token: clientToken });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.role, 'CLIENT', 'rôle effectif CLIENT attendu');
  assert.strictEqual(r.json.principalType, 'CLIENT', 'principalType CLIENT attendu');
  assert.strictEqual(r.json.nom, 'Atlas Industries', 'raison sociale attachée au profil CLIENT');
  assert.ok(r.json.telephone, 'téléphone de la fiche société présent');
  log('Client = accès portail (modèle Client) + raison sociale (/auth/me)');

  // --- 14. 2FA pour un compte CLIENT (même architecture) ---
  r = await request('POST', '/auth/2fa/setup', { token: clientToken });
  assert.strictEqual(r.status, 200);
  const clientManualKey = r.json.manualKey;
  const clientOtp = speakeasy.totp({ secret: clientManualKey, encoding: 'base32' });
  r = await request('POST', '/auth/2fa/verify-setup', { token: clientToken, body: { code: clientOtp } });
  assert.strictEqual(r.status, 200, `client 2FA verify-setup: ${JSON.stringify(r.json)}`);
  // désactivation immédiate pour laisser le compte utilisable
  r = await request('POST', '/auth/2fa/disable', { token: clientToken, body: { password: 'Password123!' } });
  assert.strictEqual(r.status, 200);
  log('2FA activée puis désactivée sur un compte CLIENT');

  // --- 15. Commentaires : auteur peuplé (pas de [object Object]) ---
  // Nouveau ticket (non clôturé) pour le test de commentaire
  r = await request('POST', '/tickets', {
    token: clientToken,
    body: {
      objet: 'Test e2e commentaire', descriptionDetaillee: 'Incident pour tester le fil de commentaires.',
      categorie: 'VM', sousCategorie: 'Extension ressources', impact: 'Faible', urgence: 'Faible',
      contrat: ctr._id.toString(),
    },
  });
  assert.strictEqual(r.status, 201, `créer ticket commentaire: ${JSON.stringify(r.json)}`);
  const commentTicketId = r.json._id;
  r = await request('POST', `/tickets/${commentTicketId}/commentaires`, {
    token: adminToken,
    body: { corps: 'Commentaire de test bout-en-bout.', visibilite: 'public' },
  });
  assert.strictEqual(r.status, 201, `créer commentaire: ${JSON.stringify(r.json)}`);
  r = await request('GET', `/tickets/${commentTicketId}/commentaires`, { token: adminToken });
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.length >= 1, 'commentaires listés');
  const c0 = r.json[0];
  assert.ok(typeof c0.auteur === 'object' && c0.auteur && c0.auteur.email, `auteur peuplé attendu, reçu: ${JSON.stringify(c0.auteur)}`);
  assert.ok(c0.auteur.firstName || c0.auteur.lastName || c0.auteur.email, 'auteur expose une identité affichable');
  log(`Commentaire : auteur peuplé (${c0.auteur.email}) — plus de [object Object] côté UI`);

  // --- 16. Client : rappel de changement de mot de passe (mustChangePassword) ---
  r = await request('POST', '/auth/login', { body: { email: 'client2@fluidity.dev', password: 'Password123!' } });
  assert.strictEqual(r.status, 200, `login client2: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.principalType, 'CLIENT', 'client2 doit être un principal CLIENT');
  assert.strictEqual(r.json.mustChangePassword, true, 'client2 doit être en mustChangePassword=true');
  const client2Token = r.json.token;
  log('Login client2 (mustChangePassword=true)');

  // Changement du mot de passe -> lève l'obligation
  r = await request('POST', '/auth/change-password', {
    token: client2Token,
    body: { currentPassword: 'Password123!', newPassword: 'NouveauPass123!', confirmation: 'NouveauPass123!' },
  });
  assert.strictEqual(r.status, 200, `change password client2: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.mustChangePassword, false, 'mustChangePassword doit passer à false');

  // Reconnexion : plus de rappel
  r = await request('POST', '/auth/login', { body: { email: 'client2@fluidity.dev', password: 'NouveauPass123!' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.mustChangePassword, false, 'plus de rappel après changement');
  log('Changement mot de passe client2 -> mustChangePassword=false (rappel levé)');

  // --- 17. Création d'un client par l'ADMIN (mot de passe provisoire + email) ---
  r = await request('POST', '/clients', {
    token: adminToken,
    body: { email: 'nouveau-client@fluidity.dev', nom: 'Nouveau Client SARL', telephone: '+216 71 999 999', adresse: 'Tunis', statut: 'Actif' },
  });
  assert.strictEqual(r.status, 201, `create client: ${JSON.stringify(r.json)}`);
  assert.ok(r.json.client && r.json.client._id, 'fiche client créée');
  // En dev (sans SMTP) le mot de passe temporaire est retourné
  const tempPwd = r.json.temporaryPassword;
  assert.ok(tempPwd && typeof tempPwd === 'string' && tempPwd.length >= 8, 'mot de passe provisoire retourné (dev)');
  // Le client peut se connecter avec le mot de passe provisoire + rappel actif
  r = await request('POST', '/auth/login', { body: { email: 'nouveau-client@fluidity.dev', password: tempPwd } });
  assert.strictEqual(r.status, 200, 'connexion client provisionné');
  assert.strictEqual(r.json.mustChangePassword, true, 'nouveau client en mustChangePassword');
  log('Admin crée un client (mot de passe provisoire + rappel actif)');

  console.log('\n[smoke] TOUS LES FLUX SONT PASSÉS.');
  await mongoose.disconnect();
  await mongod.stop();
  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] ÉCHEC :', err);
  process.exit(1);
});

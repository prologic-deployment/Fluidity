/**
 * E2E SÉCURITÉ — régressions des correctifs d'audit (domaine AUTH + proches).
 *
 * Couvre : AUTH-001 (register fermé), AUTH-002 (rôle lu en base),
 * AUTH-003 (tokenVersion, rotation refresh, reuse detection, logout),
 * AUTH-004 (rate-limit + verrouillage de compte), AUTH-005 (setup 2FA
 * prouvé par mot de passe + politique ≥ 12), AUTH-006 (codes de secours
 * bcrypt), AUTH-007 (disable = mot de passe ET code), CFG-002 (jetons de
 * reset hashés), INJ-001 (assainissement NoSQL), AUTHZ-001 (VIEWER lecture
 * seule), AUTHZ-002 (transitions bornées au propriétaire), LEAK-001
 * (contrat borné au client), API-002/LOG-002 (en-têtes sécurité + request id).
 *
 * Isolation : MongoMemoryServer dédié — aucune interaction avec la base de démo.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');

let failures = 0;
const check = (name, ok, extra = '') => {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures += 1; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

const DEMO_PASSWORD = 'Password123!';
const DEMO_2FA_SECRET = 'JBSWY3DPEHPK3PXP';
// AUTH-008 : mot de passe fort non compromis utilisé pour admin@fluidity.dev
// après la section D (le mot de passe démo seedé est dans les bases de fuites).
const MDP_ADMIN_QA = 'Restored!Qa2026';

(async () => {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri('fluidity_security_e2e');
  process.env.JWT_SECRET = 'e2e-security-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3105, '127.0.0.1', async () => {
    const base = 'http://127.0.0.1:3105';
    try {
      // ---------------------------------------------------------------- utilitaires
      const api = async (url, { method = 'GET', token, body, headers, cookies } = {}) => {
        const res = await fetch(base + url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(cookies ? { Cookie: cookies } : {}),
            ...(headers || {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await res.json(); } catch { data = {}; }
        const setCookie = res.headers.get('set-cookie');
        return { status: res.status, data, headers: res.headers, setCookie };
      };
      const extraireCookie = (setCookie, nom = 'fluidity_rt') => {
        if (!setCookie) return null;
        const m = setCookie.match(new RegExp(`${nom}=([^;]+)`));
        return m ? `${nom}=${m[1]}` : null;
      };
      const login = async (email, password = DEMO_PASSWORD) => {
        const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        return { status: r.status, token: r.data?.token, cookie: extraireCookie(r.setCookie), setCookie: r.setCookie, data: r.data };
      };
      const jwtPayload = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

      // ---------------------------------------------------------------- A. AUTH-001 : register fermé
      console.log('\n[AUTH-001] Inscription publique supprimée');
      const reg = await api('/api/auth/register', { method: 'POST', body: { email: 'pirate@example.dev', password: 'PiratePass!2026', role: 'TENANT_ADMIN' } });
      check('POST /register → 404', reg.status === 404, String(reg.status));

      // ---------------------------------------------------------------- B. Contrat de session (AUTH-003)
      console.log('\n[AUTH-003] Session : jeton court + cookie refresh + claims');
      const s1 = await login('admin@fluidity.dev');
      check('login émet token + cookie httpOnly + expiresAt', s1.status === 200 && !!s1.token && !!s1.cookie && !!s1.data.expiresAt, JSON.stringify({ status: s1.status, cookie: !!s1.cookie }));
      const claims = jwtPayload(s1.token);
      check('JWT porte tv (tokenVersion) + rôle', typeof claims.tv === 'number' && claims.role === 'TENANT_ADMIN', JSON.stringify(claims));
      check('cookie httpOnly + SameSite posés', /httponly/i.test(s1.setCookie) && /samesite=/i.test(s1.setCookie), s1.setCookie);

      // ---------------------------------------------------------------- C. AUTH-002 : rôle résolu depuis la base
      console.log('\n[AUTH-002] Rôle dynamique (rétrogradation immédiate)');
      const sa = await login('superadmin@servicedesk.dev');
      const nova = await login('nova-admin@nova-systems.dev');
      check('nova-admin accède à /users avant rétrogradation', (await api('/api/users', { token: nova.token })).status === 200);
      const novaUsers = await api(`/api/users?tenantId=${claims ? '' : ''}`, { token: sa.token });
      // Trouver l'id de nova-admin via la liste SA (portée globale)
      const listeSa = await api(`/api/users?tenantId=${jwtPayload(nova.token).tenantId}`, { token: sa.token });
      const ficheNova = (listeSa.data?.items || listeSa.data?.users || []).find((u) => u.email === 'nova-admin@nova-systems.dev');
      check('SA localise nova-admin', !!ficheNova, String(listeSa.status));
      if (ficheNova) {
        const retro = await api(`/api/users/${ficheNova._id}`, { method: 'PATCH', token: sa.token, body: { role: 'VIEWER', tenantId: jwtPayload(nova.token).tenantId } });
        check('SA rétrograde nova-admin → VIEWER', retro.status === 200, String(retro.status));
        const ancienJeton = await api('/api/users', { token: nova.token });
        check('ancien jeton révoqué par le changement de rôle (401)', ancienJeton.status === 401, String(ancienJeton.status));
        const novaViewer = await login('nova-admin@nova-systems.dev');
        check('rétrogradation lue depuis la base : nouveau jeton VIEWER', jwtPayload(novaViewer.token).role === 'VIEWER', jwtPayload(novaViewer.token).role);
        check('VIEWER refusé sur /users (rôle dynamique, 403)', (await api('/api/users', { token: novaViewer.token })).status === 403);
        const restaure = await api(`/api/users/${ficheNova._id}`, { method: 'PATCH', token: sa.token, body: { role: 'TENANT_ADMIN', tenantId: jwtPayload(nova.token).tenantId } });
        check('restauration du rôle', restaure.status === 200, String(restaure.status));
        const novaRestaure = await login('nova-admin@nova-systems.dev');
        check('droits rétablis (rôle relu en base)', jwtPayload(novaRestaure.token).role === 'TENANT_ADMIN' && (await api('/api/users', { token: novaRestaure.token })).status === 200);
      }

      // ---------------------------------------------------------------- D. AUTH-003 : changement de mot de passe révoque les autres sessions
      console.log('\n[AUTH-003] Révocation par changement de mot de passe');
      const a1 = await login('admin@fluidity.dev');
      const a2 = await login('admin@fluidity.dev');
      const neuf = 'NewSecurePass!2026';
      const chg = await api('/api/auth/change-password', { method: 'POST', token: a1.token, body: { currentPassword: DEMO_PASSWORD, newPassword: neuf } });
      check('changement de mot de passe réussi + nouveau jeton', chg.status === 200 && !!chg.data.token, String(chg.status));
      check('seconde session révoquée (401)', (await api('/api/auth/me', { token: a2.token })).status === 401);
      check('nouvelle session valide', (await api('/api/auth/me', { token: chg.data.token })).status === 200);
      check('ancien cookie refresh révoqué', (await api('/api/auth/refresh', { method: 'POST', cookies: a1.cookie })).status === 401);
      // AUTH-008 : le mot de passe démo seedé (« Password123! ») figure dans
      // les bases de fuites — le choisir à nouveau est REFUSÉ par la politique.
      // On restaure donc vers un mot de passe fort dédié (MDP_ADMIN_QA) et TOUTES
      // les connexions admin@fluidity.dev ultérieures l'utilisent.
      const retour = await api('/api/auth/change-password', { method: 'POST', token: chg.data.token, body: { currentPassword: neuf, newPassword: MDP_ADMIN_QA } });
      check('restauration vers un mot de passe fort (le démo compromis est refusé)', retour.status === 200, String(retour.status));
      // Le changement réussi ci-dessus a émis un NOUVEAU jeton (l'ancien est
      // révoqué) : c'est lui qu'on utilise pour la tentative compromise.
      const refusDemo = await api('/api/auth/change-password', { method: 'POST', token: retour.data.token, body: { currentPassword: MDP_ADMIN_QA, newPassword: DEMO_PASSWORD } });
      check('AUTH-008 : mot de passe compromis refusé (PASSWORD_BREACHED)', refusDemo.status === 400 && refusDemo.data.code === 'PASSWORD_BREACHED', JSON.stringify({ status: refusDemo.status, code: refusDemo.data?.code }));

      // ---------------------------------------------------------------- E. AUTH-003 : rotation refresh + détection de réutilisation
      console.log('\n[AUTH-003] Rotation des jetons de rafraîchissement');
      const r1 = await login('agent@fluidity.dev');
      const rf1 = await api('/api/auth/refresh', { method: 'POST', cookies: r1.cookie });
      const cookie2 = extraireCookie(rf1.setCookie);
      check('refresh valide émet un nouveau jeton + cookie tourné', rf1.status === 200 && !!rf1.data.token && !!cookie2 && cookie2 !== r1.cookie, String(rf1.status));
      const reuse = await api('/api/auth/refresh', { method: 'POST', cookies: r1.cookie });
      check('réutilisation de l’ancien cookie → 401 (reuse détectée)', reuse.status === 401, String(reuse.status));
      const famille = await api('/api/auth/refresh', { method: 'POST', cookies: cookie2 });
      check('famille entière révoquée après reuse (nouveau cookie 401)', famille.status === 401, String(famille.status));
      const r2 = await login('agent@fluidity.dev');
      const rf2 = await api('/api/auth/refresh', { method: 'POST', cookies: r2.cookie });
      const cookie3 = extraireCookie(rf2.setCookie);
      const lo = await api('/api/auth/logout', { method: 'POST', token: rf2.data.token, cookies: cookie3 });
      check('logout serveur → 2xx', lo.status < 300, String(lo.status));
      check('cookie révoqué après logout', (await api('/api/auth/refresh', { method: 'POST', cookies: cookie3 })).status === 401);

      // ---------------------------------------------------------------- F. AUTH-004 : rate-limit + verrouillage de compte
      console.log('\n[AUTH-004] Limitation de débit + verrouillage doux');
      let dernier = null;
      for (let i = 0; i < 21; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        dernier = await api('/api/auth/login', { method: 'POST', body: { email: 'bourrage@example.dev', password: 'x' } });
      }
      check('21e tentative de login (même IP+email) → 429', dernier.status === 429, String(dernier.status));
      for (let i = 0; i < 8; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await api('/api/auth/login', { method: 'POST', body: { email: '2fa.pending@fluidity.dev', password: 'MauvaisPass!1' } });
      }
      const verrou = await api('/api/auth/login', { method: 'POST', body: { email: '2fa.pending@fluidity.dev', password: DEMO_PASSWORD } });
      check('8 échecs ⇒ compte verrouillé (429 même avec le bon mot de passe)', verrou.status === 429 && verrou.data.code === 'COMPTE_VERROUILLE', `${verrou.status} ${JSON.stringify(verrou.data)}`);

      // ---------------------------------------------------------------- G. AUTH-005/006/007 : durcissement 2FA
      console.log('\n[AUTH-005/006/007] 2FA : preuve mot de passe, codes bcrypt, disable double');
      const vw = await login('viewer@fluidity.dev');
      const setupSansMdp = await api('/api/auth/2fa/setup', { method: 'POST', token: vw.token, body: {} });
      check('setup sans mot de passe → 401', setupSansMdp.status === 401, String(setupSansMdp.status));
      const setupMauvaisMdp = await api('/api/auth/2fa/setup', { method: 'POST', token: vw.token, body: { password: 'MauvaisPass!1' } });
      check('setup avec mauvais mot de passe → 401', setupMauvaisMdp.status === 401, String(setupMauvaisMdp.status));
      const setupOk = await api('/api/auth/2fa/setup', { method: 'POST', token: vw.token, body: { password: DEMO_PASSWORD } });
      check('setup prouvé par mot de passe → QR + clé manuelle', setupOk.status === 200 && !!setupOk.data.qrCode && !!setupOk.data.manualKey, String(setupOk.status));
      const code = speakeasy.totp({ secret: setupOk.data.manualKey, encoding: 'base32' });
      const verif = await api('/api/auth/2fa/verify-setup', { method: 'POST', token: vw.token, body: { code } });
      check('vérification TOTP → activation + codes de secours', verif.status === 200 && Array.isArray(verif.data.backupCodes) && verif.data.backupCodes.length > 0, `${verif.status} ${JSON.stringify(verif.data)}`);
      const { Utilisateur } = require(path.join(__dirname, '..', 'src', 'models', 'user.model'));
      const ficheVw = await Utilisateur.findOne({ email: 'viewer@fluidity.dev' }).select('+twoFactorBackupCodes +twoFactorSecret');
      check('codes de secours stockés en BCRYPT (coût ≥ 10)', ficheVw.twoFactorBackupCodes.every((c) => /^\$2[aby]\$1[0-9]\$/.test(c)), JSON.stringify(ficheVw.twoFactorBackupCodes));
      const disableMdpSeul = await api('/api/auth/2fa/disable', { method: 'POST', token: vw.token, body: { password: DEMO_PASSWORD } });
      check('disable sans code refusé (400)', disableMdpSeul.status === 400, String(disableMdpSeul.status));
      const disableMauvaisMdp = await api('/api/auth/2fa/disable', { method: 'POST', token: vw.token, body: { password: 'MauvaisPass!1', code: speakeasy.totp({ secret: setupOk.data.manualKey, encoding: 'base32' }) } });
      check('disable avec mauvais mot de passe → 401', disableMauvaisMdp.status === 401, String(disableMauvaisMdp.status));
      const disableOk = await api('/api/auth/2fa/disable', { method: 'POST', token: vw.token, body: { password: DEMO_PASSWORD, code: speakeasy.totp({ secret: setupOk.data.manualKey, encoding: 'base32' }) } });
      check('disable mot de passe ET code valide → 200', disableOk.status === 200, `${disableOk.status} ${JSON.stringify(disableOk.data)}`);

      // ---------------------------------------------------------------- H. CFG-002 : jetons de réinitialisation hashés
      console.log('\n[CFG-002] Jetons de reset jamais stockés en clair');
      const oubl = await api('/api/auth/forgot-password', { method: 'POST', body: { email: 'agent@fluidity.dev' } });
      check('forgot-password accepté', oubl.status === 200, String(oubl.status));
      const ficheAgent = await Utilisateur.findOne({ email: 'agent@fluidity.dev' }).select('+resetToken');
      check('resetToken stocké = SHA-256 hex (64 car.), jamais UUID brut', /^[0-9a-f]{64}$/.test(ficheAgent.resetToken || ''), ficheAgent.resetToken);
      const fauxReset = await api('/api/auth/reset-password', { method: 'POST', body: { token: '00000000-0000-0000-0000-000000000000', password: 'ResetTest!2026' } });
      check('reset avec mauvais jeton refusé', fauxReset.status >= 400, String(fauxReset.status));

      // ---------------------------------------------------------------- I. OTP : compteur de tentatives
      console.log('\n[AUTH-003/004] Compteur de tentatives OTP');
      const challenge = await login('2fa.enabled@fluidity.dev');
      check('compte 2FA : login exige le code (pas de jeton direct)', challenge.status === 200 && challenge.data.requiresTwoFactor === true && !challenge.data.token, JSON.stringify(challenge.data));
      const jeton2fa = challenge.data.twoFactorToken;
      let dernierOtp = null;
      for (let i = 0; i < 9; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        dernierOtp = await api('/api/auth/2fa/verify-login', { method: 'POST', body: { twoFactorToken: jeton2fa, code: '000000' } });
      }
      check('rafales de codes faux bloquées (dernier ≠ 200)', dernierOtp.status !== 200, String(dernierOtp.status));
      const bonCodeApresEchecs = await api('/api/auth/2fa/verify-login', { method: 'POST', body: { twoFactorToken: jeton2fa, code: speakeasy.totp({ secret: DEMO_2FA_SECRET, encoding: 'base32' }) } });
      check('challenge épuisé : même le bon code est refusé', bonCodeApresEchecs.status !== 200, String(bonCodeApresEchecs.status));

      // ---------------------------------------------------------------- J. INJ-001 : assainissement NoSQL
      console.log('\n[INJ-001] Injection NoSQL neutralisée');
      const inj = await api('/api/auth/login', { method: 'POST', body: { email: { $ne: null }, password: { $ne: null } } });
      check('login avec opérateurs $ne neutralisé (refus, jamais de jeton)', inj.status >= 400 && !inj.data.token, `${inj.status} ${JSON.stringify(inj.data)}`);
      const injQ = await api('/api/tickets?q[$ne]=', { token: (await login('admin@fluidity.dev', MDP_ADMIN_QA)).token });
      check('query string enrichie traitée comme texte (pas d’erreur 500)', injQ.status === 200, String(injQ.status));

      // ---------------------------------------------------------------- K. AUTHZ-001 : VIEWER lecture seule
      console.log('\n[AUTHZ-001] VIEWER en lecture seule');
      const vw2 = await login('viewer@fluidity.dev');
      const demandesAdmin = await api('/api/demandes', { token: (await login('admin@fluidity.dev', MDP_ADMIN_QA)).token });
      const uneDemande = (demandesAdmin.data?.items || [])[0];
      check('une demande seedée existe', !!uneDemande, String(demandesAdmin.status));
      if (uneDemande) {
        const editViewer = await api(`/api/demandes/${uneDemande._id}`, { method: 'PATCH', token: vw2.token, body: { objet: 'piraté' } });
        check('VIEWER ne peut PAS éditer une demande (403)', editViewer.status === 403, String(editViewer.status));
        const transViewer = await api(`/api/demandes/${uneDemande._id}/statut`, { method: 'PATCH', token: vw2.token, body: { statut: "En cours d'analyse" } });
        check('VIEWER ne peut PAS changer un statut (403)', transViewer.status === 403, String(transViewer.status));
      }
      const ticketsAdmin = await api('/api/tickets', { token: (await login('admin@fluidity.dev', MDP_ADMIN_QA)).token });
      const unTicket = (ticketsAdmin.data?.items || ticketsAdmin.data || [])[0];
      if (unTicket) {
        const comViewer = await api(`/api/tickets/${unTicket._id}/commentaires`, { method: 'POST', token: vw2.token, body: { corps: 'vu' } });
        check('VIEWER ne peut PAS commenter un ticket (403)', comViewer.status === 403, String(comViewer.status));
      }

      // ---------------------------------------------------------------- L. AUTHZ-002 : transitions bornées au propriétaire + LEAK-001
      console.log('\n[AUTHZ-002 / LEAK-001] Isolation client à client');
      const c1 = await login('client@fluidity.dev');
      const c2 = await login('client2@fluidity.dev');
      check('deux clients de connexion distincts', c1.status === 200 && c2.status === 200, `${c1.status}/${c2.status}`);
      const demandesC2 = await api('/api/demandes', { token: c2.token });
      const demandeC2 = (demandesC2.data?.items || [])[0];
      check('client2 possède au moins une demande', !!demandeC2, String(demandesC2.status));
      if (demandeC2) {
        const sabotage = await api(`/api/demandes/${demandeC2._id}/statut`, { method: 'PATCH', token: c1.token, body: { statut: 'Clôturée' } });
        check('client1 ne peut PAS clôturer la demande de client2 (404 neutre)', sabotage.status === 404, String(sabotage.status));
        const lecture = await api(`/api/demandes/${demandeC2._id}`, { token: c1.token });
        check('client1 ne lit PAS la demande de client2 (404)', lecture.status === 404, String(lecture.status));
      }
      const contratsAdmin = await api('/api/contrats', { token: (await login('admin@fluidity.dev', MDP_ADMIN_QA)).token });
      const fichesC1 = await api('/api/clients', { token: (await login('admin@fluidity.dev', MDP_ADMIN_QA)).token });
      const contratAutre = (contratsAdmin.data?.items || []).find((ct) => {
        const idClient = ct.clientId?._id || ct.clientId;
        const propre = (fichesC1.data?.items || []).find((f) => f.email === 'client@fluidity.dev');
        return propre && String(idClient) !== String(propre._id);
      });
      if (contratAutre) {
        const fuite = await api(`/api/contrats/${contratAutre._id}`, { token: c1.token });
        check('contrat d’un autre client inaccessible (404)', fuite.status === 404, String(fuite.status));
      } else {
        check('contrat d’un autre client inaccessible (404)', false, 'aucun contrat d’un autre client seedé — test non exécuté');
      }

      // ---------------------------------------------------------------- M. API-002 / LOG-002 : en-têtes + corrélation
      console.log('\n[API-002 / LOG-002] En-têtes de sécurité + request id');
      const sante = await fetch(base + '/health');
      check('CSP posée (default-src)', /default-src 'none'/.test(sante.headers.get('content-security-policy') || ''), sante.headers.get('content-security-policy'));
      check('nosniff + frame-ancestors', (sante.headers.get('x-content-type-options') || '') === 'nosniff' && /frame-ancestors 'none'/.test(sante.headers.get('content-security-policy') || ''));
      check('X-Request-Id corrélé', !!sante.headers.get('x-request-id'));

      // ---------------------------------------------------------------- N. Politique de mot de passe (AUTH-005)
      console.log('\n[AUTH-005] Politique de mot de passe ≥ 12 + 4 classes');
      const faible = await api('/api/auth/change-password', { method: 'POST', token: (await login('agent@fluidity.dev')).token, body: { currentPassword: DEMO_PASSWORD, newPassword: 'Court1!' } });
      check('mot de passe faible refusé (400)', faible.status === 400, String(faible.status));

      // ---------------------------------------------------------------- O. LOG-001 : impersonation tracée
      console.log('\n[LOG-001] Impersonation Super Admin tracée (impersonatedBy)');
      const { AuditLog } = require(path.join(__dirname, '..', 'src', 'models', 'saas.models'));
      const { Tenant: TenantModel } = require(path.join(__dirname, '..', 'src', 'models', 'tenant.model'));
      const tenantFluidity = await TenantModel.findOne({ name: 'Fluidity' }).lean();
      const creationImpersonnee = await api('/api/users', {
        method: 'POST',
        token: sa.token,
        headers: { 'X-Tenant-Override': String(tenantFluidity._id) },
        body: { email: 'impersonne.test@example.dev', password: 'Impersonne!2026', role: 'VIEWER', tenantId: String(tenantFluidity._id) },
      });
      check('SA crée un utilisateur en impersonation', creationImpersonnee.status === 201, `${creationImpersonnee.status} ${JSON.stringify(creationImpersonnee.data)}`);
      const piste = await AuditLog.findOne({ action: 'user.created', metadata: { $exists: true } }).sort({ createdAt: -1 });
      check('entrée d’audit porte impersonatedBy = le SA', !!piste && String(piste.impersonatedBy) === String(jwtPayload(sa.token).userId) && piste.metadata?.impersonated === true, JSON.stringify({ impersonatedBy: piste?.impersonatedBy, meta: piste?.metadata }));

      // ---------------------------------------------------------------- P. DB-002 : suppression logique + audit
      console.log('\n[DB-002] Suppression logique des demandes/changements + audit');
      const { Demande: DemandeModel } = require(path.join(__dirname, '..', 'src', 'models', 'demande.model'));
      const { Changement: ChangementModel } = require(path.join(__dirname, '..', 'src', 'models', 'changement.model'));
      const adminFluidity = await login('admin@fluidity.dev', MDP_ADMIN_QA);
      const avantListe = await api('/api/demandes', { token: adminFluidity.token });
      check('données seed : demandes présentes', Array.isArray(avantListe.data?.items) && avantListe.data.items.length > 0, String(avantListe.status));
      const demandeTest = avantListe.data.items[0];
      const suppr = await api(`/api/demandes/${demandeTest._id}`, { method: 'DELETE', token: adminFluidity.token });
      check('DELETE demande admin → 200', suppr.status === 200, `${suppr.status} ${JSON.stringify(suppr.data)}`);
      const relecture = await api(`/api/demandes/${demandeTest._id}`, { token: adminFluidity.token });
      check('demande tombstonnée → 404 à la relecture', relecture.status === 404, String(relecture.status));
      const liste = await api('/api/demandes', { token: adminFluidity.token });
      check('demande tombstonnée absente de la liste', Array.isArray(liste.data?.items) && !liste.data.items.some((d) => String(d._id) === String(demandeTest._id)));
      const tombe = await DemandeModel.findOne({ _id: demandeTest._id, deletedAt: { $ne: null } });
      check('la fiche reste en base avec deletedAt posé', !!tombe && tombe.deletedAt instanceof Date, JSON.stringify({ deletedAt: tombe?.deletedAt }));
      const pisteDemande = await AuditLog.findOne({ action: 'demande.deleted', resourceId: new mongoose.Types.ObjectId(demandeTest._id) }).sort({ createdAt: -1 });
      check('audit demande.deleted + softDelete', !!pisteDemande && pisteDemande.metadata?.softDelete === true, JSON.stringify(pisteDemande?.metadata));
      const avantChg = await api('/api/changements', { token: adminFluidity.token });
      check('données seed : changements présents', Array.isArray(avantChg.data?.items) && avantChg.data.items.length > 0, String(avantChg.status));
      const changementTest = avantChg.data.items[0];
      const supprChg = await api(`/api/changements/${changementTest._id}`, { method: 'DELETE', token: adminFluidity.token });
      check('DELETE changement admin → 200 + tombstone', supprChg.status === 200 && !!(await ChangementModel.findOne({ _id: changementTest._id, deletedAt: { $ne: null } })), `${supprChg.status}`);
      const pisteChg = await AuditLog.findOne({ action: 'changement.deleted', resourceId: new mongoose.Types.ObjectId(changementTest._id) }).sort({ createdAt: -1 });
      check('audit changement.deleted + softDelete', !!pisteChg && pisteChg.metadata?.softDelete === true, JSON.stringify(pisteChg?.metadata));

      // ---------------------------------------------------------------- Q. DB-005 : clés réservées du prototype purgées
      console.log('\n[DB-005] Purge __proto__/constructor/prototype des corps JSON');
      const { Contrat: ContratModel } = require(path.join(__dirname, '..', 'src', 'models', 'contrat.model'));
      const { Client: ClientModel } = require(path.join(__dirname, '..', 'src', 'models', 'client.model'));
      const loginClient = await login('client@fluidity.dev');
      check('login client portail', loginClient.status === 200, String(loginClient.status));
      const ficheClient = await ClientModel.findOne({ tenantId: tenantFluidity._id, email: 'client@fluidity.dev' }).lean();
      const contratActif = await ContratModel.findOne({ tenantId: tenantFluidity._id, clientId: ficheClient._id, statut: 'Actif' }).lean();
      const ticketPollue = await api('/api/tickets', {
        method: 'POST',
        token: loginClient.token,
        body: {
          objet: 'Ticket test pollution prototype',
          descriptionDetaillee: 'Corps porteur de clés réservées à purger.',
          categorie: 'Incident', sousCategorie: 'Réseau', impact: 'Faible', urgence: 'Faible',
          contrat: String(contratActif._id),
          specifications: JSON.parse('{"__proto__":{"polluted":true},"constructor":{"proto":{}},"prototype":{},"saine":"ok"}'),
        },
      });
      check('ticket créé malgré le payload hostile', ticketPollue.status === 201, `${ticketPollue.status} ${JSON.stringify(ticketPollue.data).slice(0, 200)}`);
      const specs = ticketPollue.data?.specifications || {};
      check('clés __proto__/constructor/prototype purgées à l’écriture', !Object.keys(specs).some((k) => ['__proto__', 'constructor', 'prototype'].includes(k)) && specs.saine === 'ok', JSON.stringify(Object.keys(specs)));
      check('Object.prototype non pollué globalement', {}.polluted === undefined && {}.proto === undefined);

      // ---------------------------------------------------------------- R. DB-004 : purge des références à la suppression d'un utilisateur
      console.log('\n[DB-004] Suppression utilisateur : purge licences / appartenances / affectations');
      const { LicenseAssignment, RoleAssignment } = require(path.join(__dirname, '..', 'src', 'models', 'saas.models'));
      const { ProjectMember, Task } = require(path.join(__dirname, '..', 'src', 'models', 'project.models'));
      const { Ticket: TicketModel } = require(path.join(__dirname, '..', 'src', 'models', 'ticket.model'));
      const { Project } = require(path.join(__dirname, '..', 'src', 'models', 'project.models'));
      const cible = await api('/api/users', {
        method: 'POST', token: adminFluidity.token,
        body: { email: 'suppression.cible@example.dev', password: 'Cible!2026Suppr', role: 'AGENT', tenantId: String(tenantFluidity._id) },
      });
      check('utilisateur cible créé', cible.status === 201, `${cible.status} ${JSON.stringify(cible.data).slice(0, 160)}`);
      const cibleId = cible.data?.user?._id || cible.data?._id;
      const projet = await Project.create({ tenantId: tenantFluidity._id, code: 'QA-DB004', name: 'Projet QA DB-004' });
      const fauxId = () => new mongoose.Types.ObjectId();
      await Promise.all([
        LicenseAssignment.create({ tenantId: tenantFluidity._id, userId: cibleId, productKey: 'servicedesk', productId: fauxId(), subscriptionId: fauxId() }),
        RoleAssignment.create({ tenantId: tenantFluidity._id, userId: cibleId, productKey: 'servicedesk', roleKey: 'sd_agent' }),
        ProjectMember.create({ tenantId: tenantFluidity._id, projectId: projet._id, userId: cibleId }),
        TicketModel.updateMany({ tenantId: tenantFluidity._id }, { $set: { assignedTo: cibleId } }),
      ]);
      const avantTicket = await TicketModel.findOne({ tenantId: tenantFluidity._id }).lean();
      check('précondition : ticket affecté à la cible', String(avantTicket.assignedTo) === String(cibleId));
      const suppression = await api(`/api/users/${cibleId}`, { method: 'DELETE', token: adminFluidity.token });
      check('DELETE utilisateur → 200', suppression.status === 200, `${suppression.status} ${JSON.stringify(suppression.data).slice(0, 160)}`);
      check('licences + rôles produit purgés',
        (await LicenseAssignment.countDocuments({ userId: cibleId })) === 0 && (await RoleAssignment.countDocuments({ userId: cibleId })) === 0);
      check('appartenances projet purgées', (await ProjectMember.countDocuments({ userId: cibleId })) === 0);
      check('tickets désaffectés (assignedTo → null)', (await TicketModel.countDocuments({ assignedTo: cibleId })) === 0 && (await TicketModel.countDocuments({ assignedTo: null, tenantId: tenantFluidity._id })) > 0);
      check('utilisateur retiré de la base', !(await Utilisateur.findOne({ _id: cibleId })));

      // ---------------------------------------------------------------- S. PERF-002 : listes paginées + filtres serveur
      console.log('\n[PERF-002] Pagination serveur des listes');
      const page1 = await api('/api/demandes?page=1&limit=3', { token: adminFluidity.token });
      check('demandes : enveloppe paginée (items/total/pages)', page1.status === 200 && Array.isArray(page1.data.items) && page1.data.items.length <= 3 && typeof page1.data.total === 'number' && page1.data.pages >= 1, JSON.stringify({ status: page1.status, n: page1.data?.items?.length, total: page1.data?.total }));
      check('demandes : plafond de page respecté (limit=3)', page1.data.items.length === 3, String(page1.data?.items?.length));
      const page2 = await api('/api/demandes?page=2&limit=3', { token: adminFluidity.token });
      check('demandes : page 2 différente de la page 1', page2.status === 200 && JSON.stringify(page2.data.items.map((d) => d._id)) !== JSON.stringify(page1.data.items.map((d) => d._id)));
      const horsBornes = await api('/api/demandes?limit=5000', { token: adminFluidity.token });
      check('demandes : limit borné à 100 max', horsBornes.data.limit <= 100, String(horsBornes.data?.limit));
      const statutFiltre = await api('/api/demandes?statut=' + encodeURIComponent('Ouverte'), { token: adminFluidity.token });
      check('demandes : filtre statut serveur', statutFiltre.status === 200 && statutFiltre.data.items.every((d) => d.statut === 'Ouverte') && typeof statutFiltre.data.stats?.parStatut === 'object', JSON.stringify(statutFiltre.data?.stats));
      const rechercheVide = await api('/api/demandes?recherche=zzzzintrouvablezzz', { token: adminFluidity.token });
      check('demandes : recherche serveur sans résultat', rechercheVide.status === 200 && rechercheVide.data.items.length === 0 && rechercheVide.data.total === 0, String(rechercheVide.data?.total));
      const listeUsers = await api('/api/users?page=1&limit=2', { token: adminFluidity.token });
      check('users : liste paginée + recherche + rôle', listeUsers.status === 200 && Array.isArray(listeUsers.data.items) && (await api('/api/users?role=TENANT_ADMIN', { token: adminFluidity.token })).data.items.every((u) => u.role === 'TENANT_ADMIN'), String(listeUsers.status));
      const listeClients = await api('/api/clients?page=1&limit=2&recherche=Atlas', { token: adminFluidity.token });
      check('clients : pagination + recherche serveur', listeClients.status === 200 && listeClients.data.items.every((c) => /atlas/i.test(c.nom)), JSON.stringify(listeClients.data?.items?.map((c) => c.nom)));

      // ---------------------------------------------------------------- T. CT-003 : champs morts (statut invité honoré, priorite dérivée)
      console.log('\n[CT-003] Champs morts : statut invité + priorité ticket');
      const emailInvite = 'qa.invite.' + Date.now() + '@fluidity.dev';
      const creeInvite = await api('/api/users', {
        method: 'POST', token: adminFluidity.token,
        body: { email: emailInvite, password: 'Invite!Passw0rd2026', role: 'VIEWER', status: 'invited' },
      });
      check('CT-003 : création utilisateur statut invited honorée', creeInvite.status === 201 && creeInvite.data.user.status === 'invited', JSON.stringify({ status: creeInvite.status, st: creeInvite.data?.user?.status }));
      const loginInvite = await api('/api/auth/login', { method: 'POST', body: { email: emailInvite, password: 'Invite!Passw0rd2026' } });
      check('CT-003 : compte invité refusé au login (403 ACCOUNT_NOT_ACTIVATED)', loginInvite.status === 403 && loginInvite.data.code === 'ACCOUNT_NOT_ACTIVATED', JSON.stringify({ status: loginInvite.status, code: loginInvite.data?.code }));
      const activeInvite = await api('/api/users/' + creeInvite.data.user._id, { method: 'PATCH', token: adminFluidity.token, body: { status: 'active' } });
      check('CT-003 : activation du compte invité', activeInvite.status === 200 && activeInvite.data.user.status === 'active', JSON.stringify({ status: activeInvite.status }));
      const loginActif = await api('/api/auth/login', { method: 'POST', body: { email: emailInvite, password: 'Invite!Passw0rd2026' } });
      check('CT-003 : compte activé peut se connecter', loginActif.status === 200, String(loginActif.status));
      // La création de ticket est réservée aux CLIENTs (requireRole CLIENT) :
      // on passe par le client seedé Atlas (contrats actifs seedés).
      const loginAtlas = await login('client@fluidity.dev');
      const ficheAtlas = await ClientModel.findOne({ tenantId: tenantFluidity._id, email: 'client@fluidity.dev' }).lean();
      const contratsAtlas = await api('/api/contrats?limit=100', { token: adminFluidity.token });
      const contratAtlas = (contratsAtlas.data?.items || []).find((c) => String(c.clientId?._id || c.clientId) === String(ficheAtlas._id) && c.statut === 'Actif');
      check('CT-003 : prérequis — contrat actif pour le client Atlas', Boolean(contratAtlas), String(contratAtlas?.reference));
      const ticketAvecPriorite = await api('/api/tickets', {
        method: 'POST', token: loginAtlas.token,
        body: {
          objet: 'QA CT-003 priorite ignoree',
          descriptionDetaillee: 'La priorité envoyée par le client doit être ignorée et recalculée.',
          categorie: 'VM', sousCategorie: 'Création VM',
          impact: 'Faible', urgence: 'Faible',
          contrat: contratAtlas?._id,
          priorite: 'P1',
        },
      });
      check('CT-003 : priorite envoyée ignorée → recalculée (P4 pour Faible/Faible)', ticketAvecPriorite.status === 201 && ticketAvecPriorite.data.priorite === 'P4', JSON.stringify({ status: ticketAvecPriorite.status, priorite: ticketAvecPriorite.data?.priorite }));
      // INFO-004 (vérification runtime) : la re-qualification Critique/Critique
      // passe le ticket P1 ET réancre les cibles SLA sur la nouvelle priorité.
      const requalif = await api('/api/tickets/' + ticketAvecPriorite.data._id, {
        method: 'PATCH', token: adminFluidity.token,
        body: { impact: 'Critique', urgence: 'Critique' },
      });
      const slaRequalif = requalif.data?.sla || {};
      const ecartHeures = slaRequalif.resolutionDueAt ? Math.abs((new Date(slaRequalif.resolutionDueAt).getTime() - Date.now()) / 3600000 - 4) : 99;
      check('INFO-004 : re-qualification → P1 + SLA réancré (4 h résolution)', requalif.status === 200 && requalif.data.priorite === 'P1' && slaRequalif.resolutionHeures === 4 && ecartHeures < 0.2, JSON.stringify({ status: requalif.status, priorite: requalif.data?.priorite, resolutionHeures: slaRequalif.resolutionHeures, ecartHeures: +ecartHeures.toFixed(3) }));
    } catch (err) {
      failures += 1;
      console.error('ERREUR DE DÉROULEMENT :', err);
    } finally {
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      console.log(failures === 0 ? '\nRésultat : OK — toutes les régressions sécurité passent.' : `\nRésultat : ${failures} ÉCHEC(S)`);
      process.exit(failures === 0 ? 0 : 1);
    }
  });
})();

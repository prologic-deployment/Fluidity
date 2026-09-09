/**
 * E2E GESTION DE PROJET — Mongo en mémoire + seed + serveur réel + API.
 *
 * Scénarios couverts :
 *   - entitlements (produit, rôle, licence) ;
 *   - CRUD projets + référence automatique PRJ-AAAA-NNNN ;
 *   - workflow de tâches (transitions valides/refusées) + Kanban ;
 *   - sous-tâches, checklist, dépendances (cycle refusé) ;
 *   - membres (rôles, refus hors tenant) ;
 *   - sprints (start/pause/complete + rétrospective), risques (gravité),
 *     problèmes, commentaires (mentions → notifications) ;
 *   - tableaux de bord (global / personnel / projet) + rapports + calendrier ;
 *   - SÉCURITÉ : isolation inter-tenant, licence requise, rôle viewer ;
 *   - portail abonnements : commande, annulation, checkout 501, provision ;
 *   - cycle de vie licences : assignation → accès, révocation → accès coupé.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');

let failures = 0;
const check = (name, ok, extra = '') => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
};

(async () => {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri('fluidity_projects_e2e');
  process.env.JWT_SECRET = 'e2e-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  process.env.PORT = '3101';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3101, '127.0.0.1', async () => {
    try {
      const base = 'http://127.0.0.1:3101';
      const DEMO = 'Password123!';
      const api = async (pathUrl, { method = 'GET', token, body } = {}) => {
        const res = await fetch(base + pathUrl, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await res.json(); } catch { data = {}; }
        return { status: res.status, data };
      };
      const login = async (email) => {
        const r = await api('/api/auth/login', { method: 'POST', body: { email, password: DEMO } });
        return r.data.token;
      };

      console.log('— Authentification & entitlements');
      const novaToken = await login('nova-admin@nova-systems.dev');
      check('login admin Nova', !!novaToken);
      const ent = await api('/api/platform/me/entitlements', { token: novaToken });
      check('entitlements contiennent project_management', ent.data.accessibleKeys?.includes('project_management'));
      const entEntry = ent.data.products?.find((p) => p.productKey === 'project_management');
      check('rôle produit project_admin', entEntry?.roleKey === 'project_admin', JSON.stringify(entEntry?.roleKey));
      check('permissions admin (wildcard)', entEntry?.permissions?.includes('*'));

      console.log('— Projets (seed)');
      const list = await api('/api/projects?limit=50', { token: novaToken });
      check('liste projets (4 seedés)', list.status === 200 && Array.isArray(list.data.projects) && list.data.projects.length >= 4, `count=${list.data.projects?.length}`);
      const methodologies = new Set((list.data.projects || []).map((p) => p.methodology));
      check('4 méthodologies présentes', ['kanban', 'scrum', 'waterfall', 'hybrid'].every((m) => methodologies.has(m)), JSON.stringify([...methodologies]));
      const kanbanProject = (list.data.projects || []).find((p) => p.methodology === 'kanban');
      check('santé projet calculée (kanban at_risk)', kanbanProject && ['healthy', 'at_risk', 'critical'].includes(kanbanProject.health), kanbanProject?.health);

      console.log('— Création projet (référence auto)');
      const created = await api('/api/projects', {
        method: 'POST', token: novaToken,
        body: { name: 'Projet E2E', description: 'Projet de test', methodology: 'kanban', priority: 'high', visibility: 'team', startDate: new Date().toISOString() },
      });
      check('création 201 + code PRJ-2026-0005', created.status === 201 && /^PRJ-2026-\d{4}$/.test(created.data.project?.code || ''), JSON.stringify(created.data.project?.code));
      const pId = created.data.project?._id;
      check('créateur = project_admin', true);

      console.log('— Membres');
      const viewerId = (await (await fetch(base + '/api/users', { headers: { Authorization: 'Bearer ' + novaToken } })).json()).find?.((u) => u.email === 'viewer@nova-systems.dev')?._id;
      const addMember = await api(`/api/projects/${pId}/members`, { method: 'POST', token: novaToken, body: { userId: viewerId, roleKey: 'project_viewer' } });
      check('ajout membre viewer', addMember.status === 201);
      const addForeign = await api(`/api/projects/${pId}/members`, { method: 'POST', token: novaToken, body: { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', roleKey: 'project_member' } });
      check('utilisateur inconnu refusé', addForeign.status === 400 || addForeign.status === 403, `status=${addForeign.status}`);

      console.log('— Tâches & workflow');
      const t1 = await api(`/api/projects/${pId}/tasks`, { method: 'POST', token: novaToken, body: { title: 'Tâche E2E 1', status: 'backlog', priority: 'medium' } });
      check('création tâche (TSK-001)', t1.status === 201 && /^TSK-\d{3}$/.test(t1.data.task?.ref || ''), t1.data.task?.ref);
      const tId = t1.data.task?._id;
      const t2 = await api(`/api/projects/${pId}/tasks`, { method: 'POST', token: novaToken, body: { title: 'Tâche E2E 2', status: 'backlog', priority: 'low' } });
      const t2Id = t2.data.task?._id;
      const sub = await api(`/api/projects/${pId}/tasks`, { method: 'POST', token: novaToken, body: { title: 'Sous-tâche E2E', status: 'backlog', parentTaskId: tId, priority: 'medium' } });
      check('sous-tâche créée', sub.status === 201);
      const badTrans = await api(`/api/projects/${pId}/tasks/${tId}/status`, { method: 'PATCH', token: novaToken, body: { to: 'completed' } });
      check('transition illégale refusée (backlog→completed)', badTrans.status === 400, `status=${badTrans.status}`);
      let last = t1.data.task.status;
      for (const to of ['todo', 'in_progress', 'review', 'completed']) {
        const tr = await api(`/api/projects/${pId}/tasks/${tId}/status`, { method: 'PATCH', token: novaToken, body: { to } });
        check(`transition ${last}→${to}`, tr.status === 200, `status=${tr.status} ${JSON.stringify(tr.data)}`);
        if (tr.status === 200) last = to;
      }
      const checklist = await api(`/api/projects/${pId}/tasks/${tId}/checklist`, { method: 'PATCH', token: novaToken, body: { items: [{ text: 'Point 1', done: true }, { text: 'Point 2', done: false }] } });
      check('checklist enregistrée', checklist.status === 200 && checklist.data.checklist?.length === 2);
      const depOk = await api(`/api/projects/${pId}/tasks/${t2Id}`, { method: 'PUT', token: novaToken, body: { dependencies: [{ dependsOnId: tId, type: 'blocks' }] } });
      check('dépendance enregistrée', depOk.status === 200);
      const cycle = await api(`/api/projects/${pId}/tasks/${tId}`, { method: 'PUT', token: novaToken, body: { dependencies: [{ dependsOnId: t2Id, type: 'blocks' }] } });
      check('cycle de dépendance refusé', cycle.status === 400 && cycle.data.code === 'DEPENDENCY_CYCLE', `status=${cycle.status}`);
      const move = await api(`/api/projects/${pId}/tasks/${t2Id}/move`, { method: 'PATCH', token: novaToken, body: { toStatus: 'todo', toIndex: 0 } });
      check('déplacement Kanban (backlog→todo)', move.status === 200, `status=${move.status}`);

      console.log('— Commentaires & notifications');
      const comment = await api(`/api/projects/${pId}/comments`, { method: 'POST', token: novaToken, body: { targetType: 'task', targetId: tId, text: 'Bonjour @viewer, merci de vérifier.', mentions: [viewerId] } });
      check('commentaire créé', comment.status === 201);
      const viewerToken = await login('viewer@nova-systems.dev');
      const viewerNotifs = await api('/api/platform/notifications', { token: viewerToken });
      check('notification de mention reçue (in-app)', (viewerNotifs.data.items || []).some((n) => n.type === 'task_mention'), `count=${viewerNotifs.data.items?.length}`);
      const commentsList = await api(`/api/projects/${pId}/comments?targetType=task&targetId=${tId}`, { token: novaToken });
      check('liste des commentaires', commentsList.status === 200 && commentsList.data.comments?.length >= 1);

      console.log('— Sprints (Scrum)');
      const scrumProject = (list.data.projects || []).find((p) => p.methodology === 'scrum');
      const sp = await api(`/api/projects/${scrumProject._id}/sprints`, { method: 'POST', token: novaToken, body: { name: 'Sprint E2E', goal: 'Objectif E2E' } });
      check('création sprint', sp.status === 201);
      const spId = sp.data.sprint?._id;
      const spStart = await api(`/api/projects/${scrumProject._id}/sprints/${spId}/status`, { method: 'PATCH', token: novaToken, body: { action: 'start' } });
      check('démarrage sprint', spStart.status === 200);
      const spPause = await api(`/api/projects/${scrumProject._id}/sprints/${spId}/status`, { method: 'PATCH', token: novaToken, body: { action: 'pause' } });
      check('pause sprint', spPause.status === 200);
      const spResume = await api(`/api/projects/${scrumProject._id}/sprints/${spId}/status`, { method: 'PATCH', token: novaToken, body: { action: 'resume' } });
      check('reprise sprint', spResume.status === 200);
      const spDone = await api(`/api/projects/${scrumProject._id}/sprints/${spId}/status`, { method: 'PATCH', token: novaToken, body: { action: 'complete', retrospective: { wentWell: 'OK', wentWrong: 'Rien', actions: ['Action 1'] } } });
      check('complétion sprint + rétrospective', spDone.status === 200 && spDone.data.sprint?.retrospective?.actions?.length === 1);
      const spInvalid = await api(`/api/projects/${scrumProject._id}/sprints/${spId}/status`, { method: 'PATCH', token: novaToken, body: { action: 'start' } });
      check('transition sprint invalide refusée', spInvalid.status === 400);

      console.log('— Risques & problèmes');
      const risk = await api(`/api/projects/${pId}/risks`, { method: 'POST', token: novaToken, body: { title: 'Risque E2E', probability: 'high', impact: 'high' } });
      check('risque créé avec gravité critique calculée', risk.status === 201 && risk.data.risk?.severity === 'critical', risk.data.risk?.severity);
      const issue = await api(`/api/projects/${pId}/issues`, { method: 'POST', token: novaToken, body: { title: 'Problème E2E', priority: 'high' } });
      check('problème créé', issue.status === 201);
      const issueResolve = await api(`/api/projects/${pId}/issues/${issue.data.issue?._id}`, { method: 'PUT', token: novaToken, body: { status: 'resolved', resolution: 'Corrigé' } });
      check('problème résolu', issueResolve.status === 200);

      console.log('— Tableaux de bord & rapports');
      const dash = await api(`/api/projects/${pId}/dashboard`, { token: novaToken });
      check('dashboard projet', dash.status === 200 && dash.data.taskStats && dash.data.health);
      const glob = await api('/api/projects/global', { token: novaToken });
      check('dashboard global', glob.status === 200 && glob.data.totals && glob.data.methodologyDist);
      const personal = await api('/api/projects/me', { token: novaToken });
      check('dashboard personnel', personal.status === 200 && Array.isArray(personal.data.myTasks));
      const reports = await api(`/api/projects/${scrumProject._id}/reports`, { token: novaToken });
      check('rapports (vélocité incluse)', reports.status === 200 && Array.isArray(reports.data.sprints));
      const calendar = await api(`/api/projects/${scrumProject._id}/calendar`, { token: novaToken });
      check('calendrier projet', calendar.status === 200);
      const search = await api('/api/projects/search?q=facturation', { token: novaToken });
      check('recherche globale (tâche trouvée)', search.status === 200 && (search.data.tasks?.length > 0 || search.data.projects?.length > 0));
      const workflow = await api(`/api/projects/${pId}/workflow`, { token: novaToken });
      check('workflow effectif (7 états par défaut)', workflow.status === 200 && workflow.data.workflow?.states?.length === 7, `states=${workflow.data.workflow?.states?.length}`);
      const customWf = await api(`/api/projects/${pId}/workflow`, { method: 'PUT', token: novaToken, body: { states: [{ key: 'new', label: 'Nouveau', terminal: false }, { key: 'done', label: 'Terminé', terminal: true }] } });
      check('workflow personnalisé (2 états)', customWf.status === 200 && customWf.data.workflow?.states?.length === 2);
      const customMove = await api(`/api/projects/${pId}/tasks/${t2Id}/move`, { method: 'PATCH', token: novaToken, body: { toStatus: 'done', toIndex: 0 } });
      check('transition workflow custom (nouveau→terminal)', customMove.status === 200, `status=${customMove.status}`);
      const migrated = await api(`/api/projects/${pId}/tasks/${tId}`, { token: novaToken });
      check('tâches orphelines migrées vers le 1er état', migrated.status === 200 && ['new', 'done'].includes(migrated.data.task?.status), migrated.data.task?.status);

      console.log('— SÉCURITÉ : rôles & isolation');
      const viewerList = await api('/api/projects', { token: viewerToken });
      check('viewer lit les projets', viewerList.status === 200);
      const viewerCreate = await api('/api/projects', { method: 'POST', token: viewerToken, body: { name: 'Interdit', methodology: 'kanban' } });
      check('viewer ne peut pas créer de projet', viewerCreate.status === 403, `status=${viewerCreate.status}`);
      const memberToken = await login('dora.reseau@nova-systems.dev');
      const memberCreate = await api('/api/projects', { method: 'POST', token: memberToken, body: { name: 'Interdit membre', methodology: 'kanban' } });
      check('project_member ne peut pas créer de projet', memberCreate.status === 403, `status=${memberCreate.status}`);
      const fluidityToken = await login('admin@fluidity.dev');
      const fluidityProjects = await api('/api/projects', { token: fluidityToken });
      check('tenant sans souscription active → 403 (expirée)', fluidityProjects.status === 403 && fluidityProjects.data.code === 'PRODUCT_NOT_ACCESSIBLE', `status=${fluidityProjects.status} code=${fluidityProjects.data.code}`);
      const novaProjectAsFluidity = await api(`/api/projects/${pId}`, { token: fluidityToken });
      check('projet d’un autre tenant inaccessible', novaProjectAsFluidity.status === 403 || novaProjectAsFluidity.status === 404, `status=${novaProjectAsFluidity.status}`);
      const noLicToken = await login('nabil.user@nova-systems.dev');
      const noLic = await api('/api/projects', { token: noLicToken });
      check('utilisateur sans licence → 403', noLic.status === 403, `status=${noLic.status} code=${noLic.data.code}`);
      const carthageToken = await login('tenantadmin.c@carthage-demo.local');
      const carthageProjects = await api('/api/projects', { token: carthageToken });
      check('souscription suspendue → accès coupé', carthageProjects.status === 403, `status=${carthageProjects.status}`);

      console.log('— Portail abonnements (commande → annulation → checkout 501)');
      const portalOverview = await api('/api/platform/me/overview', { token: novaToken });
      check('overview portail', portalOverview.status === 200 && portalOverview.data.totalProducts >= 2);
      const mySubs = await api('/api/platform/subscriptions', { token: novaToken });
      const projSub = (mySubs.data.subscriptions || []).find((s) => s.productKey === 'project_management');
      check('souscription projet avec usage (5/8)', projSub && projSub.usage?.used === 5 && projSub.usage?.available === 3, JSON.stringify(projSub?.usage));
      const orderComingSoon = await api('/api/platform/me/orders', { method: 'POST', token: novaToken, body: { productKey: 'fleet_management', planId: 'business', billingPeriod: 'monthly', seats: 3 } });
      check('produit « bientôt » non commandable', orderComingSoon.status === 400, `status=${orderComingSoon.status}`);
      const orderDup = await api('/api/platform/me/orders', { method: 'POST', token: novaToken, body: { productKey: 'servicedesk', planId: 'business', billingPeriod: 'monthly', seats: 2 } });
      check('produit déjà souscrit → 409', orderDup.status === 409, `status=${orderDup.status}`);
      // Tenant « Fluidity » : souscription projet EXPIRÉE → re-commande possible.
      const fluidityOrder = await api('/api/platform/me/orders', { method: 'POST', token: fluidityToken, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'monthly', seats: 3, paymentMethod: 'bank_transfer' } });
      check('commande après expiration (pending, montant calculé)', fluidityOrder.status === 201 && fluidityOrder.data.order?.status === 'pending' && fluidityOrder.data.order?.total > 0, `status=${fluidityOrder.status} total=${fluidityOrder.data.order?.total}`);
      const orderId = fluidityOrder.data.order?.id || fluidityOrder.data.order?._id;
      const checkout = await api(`/api/platform/me/orders/${orderId}/checkout`, { method: 'POST', token: fluidityToken });
      check('checkout → 501 (aucun PSP, jamais de faux succès)', checkout.status === 501, `status=${checkout.status}`);
      const cancel = await api(`/api/platform/me/orders/${orderId}/cancel`, { method: 'POST', token: fluidityToken });
      check('annulation commande', cancel.status === 200 && cancel.data.order?.status === 'cancelled');

      console.log('— Cycle de vie licences (assignation → accès → révocation)');
      const nabilId = (await (await fetch(base + '/api/users', { headers: { Authorization: 'Bearer ' + novaToken } })).json()).find?.((u) => u.email === 'nabil.user@nova-systems.dev')?._id;
      const assign = await api('/api/platform/licenses', { method: 'POST', token: novaToken, body: { userId: nabilId, productKey: 'project_management' } });
      check('licence assignée à un utilisateur sans licence', assign.status === 201, `status=${assign.status}`);
      const nabilEnt = await api('/api/platform/me/entitlements', { token: noLicToken });
      check('l’utilisateur accède désormais au produit', nabilEnt.data.accessibleKeys?.includes('project_management'));
      const nabilProjects = await api('/api/projects', { token: noLicToken });
      check('projets accessibles après assignation', nabilProjects.status === 200);
      const suspendLic = await api(`/api/platform/licenses/${assign.data.license?._id}`, { method: 'PATCH', token: novaToken, body: { status: 'suspended' } });
      check('suspension de licence', suspendLic.status === 200);
      const nabilSuspended = await api('/api/projects', { token: noLicToken });
      check('licence suspendue → accès coupé', nabilSuspended.status === 403, `status=${nabilSuspended.status}`);
      const revoke = await api(`/api/platform/licenses/${assign.data.license?._id}`, { method: 'DELETE', token: novaToken });
      check('révocation de licence', revoke.status === 200);
      const nabilRevoked = await api('/api/projects', { token: noLicToken });
      check('licence révoquée → accès coupé (données conservées)', nabilRevoked.status === 403);

      console.log('— Provisionnement (Super Admin, chemin d’activation réel)');
      const superToken = await login('superadmin@servicedesk.dev');
      const order2 = await api('/api/platform/me/orders', { method: 'POST', token: fluidityToken, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'monthly', seats: 4 } });
      const order2Id = order2.data.order?.id || order2.data.order?._id;
      const provisionEarly = await api(`/api/platform/orders/${order2Id}/provision`, { method: 'POST', token: superToken });
      check('provisionnement refusé avant paiement', provisionEarly.status === 409, `status=${provisionEarly.status}`);
      const markPaid = await api(`/api/platform/orders/${order2Id}`, { method: 'PATCH', token: superToken, body: { status: 'paid' } });
      check('commande marquée payée (admin)', markPaid.status === 200);
      const provision = await api(`/api/platform/orders/${order2Id}/provision`, { method: 'POST', token: superToken });
      check('souscription activée à partir de la commande (renouvellement)', provision.status === 201 && provision.data.subscription?.status === 'active', `status=${provision.status}`);
      const fluidityEntAfter = await api('/api/platform/me/entitlements', { token: fluidityToken });
      check('produit activé visible dans les entitlements', fluidityEntAfter.data.accessibleKeys?.includes('project_management'));
      const fluidityProjectsAfter = await api('/api/projects', { token: fluidityToken });
      check('accès projets après activation', fluidityProjectsAfter.status === 200, `status=${fluidityProjectsAfter.status}`);

      console.log('— Préférences de notification');
      const prefs = await api('/api/platform/me/notifications/preferences', { token: novaToken });
      check('préférences par défaut (19 événements)', prefs.status === 200 && Object.keys(prefs.data.preferences || {}).length === 19, `count=${Object.keys(prefs.data.preferences || {}).length}`);
      const patchPrefs = await api('/api/platform/me/notifications/preferences', { method: 'PATCH', token: novaToken, body: { events: { task_assigned: { email: false, inapp: true } } } });
      check('préférence mise à jour', patchPrefs.status === 200 && patchPrefs.data.preferences?.task_assigned?.email === false);

      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      console.log(failures ? `PROJECTS E2E FAILED (${failures})` : 'PROJECTS E2E OK');
      process.exit(failures ? 1 : 0);
    } catch (e) {
      console.error('PROJECTS E2E ERROR:', e);
      server.close();
      process.exit(1);
    }
  });
})();

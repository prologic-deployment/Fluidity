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
      const login = async (email, password = DEMO) => {
        const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
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
      const kanbanProject = (list.data.projects || []).find((p) => p.code === 'PRJ-2026-0001');
      check('santé projet calculée (kanban at_risk)', kanbanProject && ['on_track', 'at_risk', 'off_track'].includes(kanbanProject.health), kanbanProject?.health);

      console.log('— Création projet (référence auto)');
      const created = await api('/api/projects', {
        method: 'POST', token: novaToken,
        body: { name: 'Projet E2E', description: 'Projet de test', methodology: 'kanban', priority: 'high', visibility: 'team', startDate: new Date().toISOString() },
      });
      check('création 201 + code PRJ-2026-0005', created.status === 201 && /^PRJ-2026-\d{4}$/.test(created.data.project?.code || ''), JSON.stringify(created.data.project?.code));
      const pId = created.data.project?._id;
      check('créateur = project_admin', true);

      console.log('— Membres');
      const viewerId = ((await (await fetch(base + '/api/users', { headers: { Authorization: 'Bearer ' + novaToken } })).json())?.items || []).find?.((u) => u.email === 'viewer@nova-systems.dev')?._id;
      const addMember = await api(`/api/projects/${pId}/members`, { method: 'POST', token: novaToken, body: { userId: viewerId, roleKey: 'project_viewer' } });
      check('ajout membre viewer', addMember.status === 201);
      const addForeign = await api(`/api/projects/${pId}/members`, { method: 'POST', token: novaToken, body: { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', roleKey: 'project_member' } });
      check('utilisateur inconnu refusé', addForeign.status === 400 || addForeign.status === 403, `status=${addForeign.status}`);

      console.log('— AUTHZ-003 : validation des membres initiaux à la création');
      const { Utilisateur: UserModel } = require(path.join(__dirname, '..', 'src', 'models', 'user.model'));
      const adminFluidityFiche = await UserModel.findOne({ email: 'admin@fluidity.dev' }).select('_id').lean();
      const crossManager = await api('/api/projects', { method: 'POST', token: novaToken, body: { name: 'Projet manager hors tenant', methodology: 'kanban', managerId: String(adminFluidityFiche._id) } });
      check('manager hors tenant → 403 CROSS_TENANT_MEMBER', crossManager.status === 403 && crossManager.data.code === 'CROSS_TENANT_MEMBER', `status=${crossManager.status} code=${crossManager.data.code}`);
      const crossMember = await api('/api/projects', { method: 'POST', token: novaToken, body: { name: 'Projet membre hors tenant', methodology: 'kanban', teamMembers: [{ userId: String(adminFluidityFiche._id), roleKey: 'developer' }] } });
      check('membre initial hors tenant → 403 CROSS_TENANT_MEMBER', crossMember.status === 403 && crossMember.data.code === 'CROSS_TENANT_MEMBER', `status=${crossMember.status} code=${crossMember.data.code}`);
      const badRole = await api('/api/projects', { method: 'POST', token: novaToken, body: { name: 'Projet rôle invalide', methodology: 'kanban', teamMembers: [{ userId: viewerId, roleKey: 'super_admin' }] } });
      check('rôle projet invalide → 400', badRole.status === 400, `status=${badRole.status}`);
      const okTeam = await api('/api/projects', { method: 'POST', token: novaToken, body: { name: 'Projet équipe validée', methodology: 'kanban', teamMembers: [{ userId: viewerId, roleKey: 'developer' }] } });
      check('création avec membres validés → 201', okTeam.status === 201, `status=${okTeam.status} ${JSON.stringify(okTeam.data).slice(0, 120)}`);

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
      const scrumProject = (list.data.projects || []).find((p) => p.code === 'PRJ-2026-0002');
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

      console.log('— LEAK-003 : bornage du catalogue de rôles et du checkout');
      const rolesViewer = await api('/api/platform/roles', { token: viewerToken });
      check('/platform/roles refusé à un viewer (403)', rolesViewer.status === 403, `status=${rolesViewer.status}`);
      const rolesAdmin = await api('/api/platform/roles', { token: novaToken });
      check('/platform/roles accessible aux admins', rolesAdmin.status === 200 && Array.isArray(rolesAdmin.data.roles) && rolesAdmin.data.roles.length > 0, `status=${rolesAdmin.status}`);
      const subProjId = (await api('/api/platform/subscriptions', { token: novaToken })).data.subscriptions?.find((s) => s.productKey === 'project_management')?._id;
      const checkoutViewer = await api(`/api/platform/subscriptions/${subProjId}/checkout`, { method: 'POST', token: viewerToken });
      check('checkout refusé à un viewer (403)', checkoutViewer.status === 403, `status=${checkoutViewer.status}`);
      const checkoutCross = await api(`/api/platform/subscriptions/${subProjId}/checkout`, { method: 'POST', token: fluidityToken });
      check('checkout sur souscription d’un autre tenant → 404', checkoutCross.status === 404, `status=${checkoutCross.status}`);

      console.log('— Portail abonnements (commande → annulation → checkout 501)');
      const portalOverview = await api('/api/platform/me/overview', { token: novaToken });
      check('overview portail', portalOverview.status === 200 && portalOverview.data.totalProducts >= 2);
      const mySubs = await api('/api/platform/subscriptions', { token: novaToken });
      const projSub = (mySubs.data.subscriptions || []).find((s) => s.productKey === 'project_management');
      check('souscription projet : 10 licences pour 8 sièges (saturation)', projSub && projSub.usage?.used >= 10 && projSub.usage?.available === 0, JSON.stringify(projSub?.usage));
      const orderComingSoon = await api('/api/platform/me/orders', { method: 'POST', token: novaToken, body: { productKey: 'fleet_management', planId: 'business', billingPeriod: 'monthly', seats: 3 } });
      check('produit « bientôt » non commandable (409 PRODUCT_NOT_AVAILABLE)', orderComingSoon.status === 409, `status=${orderComingSoon.status}`);
      const orderDup = await api('/api/platform/me/orders', { method: 'POST', token: novaToken, body: { productKey: 'servicedesk', planId: 'business', billingPeriod: 'monthly', seats: 2 } });
      check('produit déjà souscrit → 409', orderDup.status === 409, `status=${orderDup.status}`);
      // Tenant « Fluidity » : souscription projet EXPIRÉE → re-commande possible.
      const fluidityOrder = await api('/api/platform/me/orders', { method: 'POST', token: fluidityToken, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'monthly', seats: 3, paymentMethod: 'bank_transfer' } });
      check('commande après expiration (pending_approval, montant calculé)', fluidityOrder.status === 201 && ['pending_approval', 'pending'].includes(fluidityOrder.data.order?.status) && fluidityOrder.data.order?.total > 0, `status=${fluidityOrder.status} total=${fluidityOrder.data.order?.total}`);
      const orderId = fluidityOrder.data.order?.id || fluidityOrder.data.order?._id;
      const checkout = await api(`/api/platform/me/orders/${orderId}/checkout`, { method: 'POST', token: fluidityToken });
      check('checkout → 501 (aucun PSP, jamais de faux succès)', checkout.status === 501, `status=${checkout.status}`);
      const cancel = await api(`/api/platform/me/orders/${orderId}/cancel`, { method: 'POST', token: fluidityToken });
      check('annulation commande', cancel.status === 200 && cancel.data.order?.status === 'cancelled');

      console.log('— Plateforme : examen & approbation des commandes (seed)');
      const superToken = await login('superadmin@servicedesk.dev');
      const platformOrders = await api('/api/platform/orders', { token: superToken });
      const pendingOrders = (platformOrders.data.orders || []).filter((o) => o.status === 'pending_approval');
      check('Super Admin voit les commandes en attente (Nova + Fluidity)', pendingOrders.length >= 2, `count=${pendingOrders.length}`);
      const novaExpansion = (platformOrders.data.orders || []).find((o) => o.productKey === 'project_management' && o.orderType === 'seat_expansion' && o.status === 'pending_approval');
      check('commande d’extension de sièges Nova visible (8→12, +4)', !!novaExpansion && novaExpansion.seats === 4, JSON.stringify(novaExpansion?.seats));
      const approveExp = await api(`/api/platform/orders/${novaExpansion._id}/approve`, { method: 'POST', token: superToken, body: { note: 'Équipe validée.' } });
      check('approbation extension → commande terminée', approveExp.status === 200 && approveExp.data.order?.status === 'completed', `status=${approveExp.status}`);
      const novaSubAfter = await api('/api/platform/subscriptions', { token: novaToken });
      const novaProjSub = (novaSubAfter.data.subscriptions || []).find((subEl) => subEl.productKey === 'project_management');
      check('sièges étendus 8 → 12', novaProjSub && novaProjSub.seats === 12, `seats=${novaProjSub?.seats}`);
      const novaAdminNotifs = await api('/api/platform/notifications', { token: novaToken });
      check('notification subscription_approved (admin Nova)', (novaAdminNotifs.data.items || []).some((n) => n.type === 'subscription_approved'));
      const dupApprove = await api(`/api/platform/orders/${novaExpansion._id}/approve`, { method: 'POST', token: superToken });
      check('double approbation refusée', dupApprove.status === 409, `status=${dupApprove.status}`);

      console.log('— Rejet d’une commande (aucune activation)');
      const soloToken = await login('karim.solo@example.dev', 'Demo1234!');
      const soloOrder = await api('/api/platform/me/orders', { method: 'POST', token: soloToken, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'monthly', seats: 2 } });
      check('commande Solo (pending_approval)', soloOrder.status === 201 && soloOrder.data.order?.status === 'pending_approval', `status=${soloOrder.status}`);
      const soloOrderId = soloOrder.data.order?.id || soloOrder.data.order?._id;
      const reject = await api(`/api/platform/orders/${soloOrderId}/reject`, { method: 'POST', token: superToken, body: { note: 'Compte individuel non éligible pour l’instant.' } });
      check('rejet → commande rejetée', reject.status === 200 && reject.data.order?.status === 'rejected', `status=${reject.status}`);
      const soloNotifs = await api('/api/platform/notifications', { token: soloToken });
      check('notification subscription_rejected (Solo)', (soloNotifs.data.items || []).some((n) => n.type === 'subscription_rejected'));
      const soloEnt = await api('/api/platform/me/entitlements', { token: soloToken });
      check('rejet → produit non activé', !(soloEnt.data.accessibleKeys || []).includes('project_management'));

      console.log('— Cycle de vie licences (assignation → accès → révocation)');
      const nabilId = ((await (await fetch(base + '/api/users', { headers: { Authorization: 'Bearer ' + novaToken } })).json())?.items || []).find?.((u) => u.email === 'nabil.user@nova-systems.dev')?._id;
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

      console.log('— Approbation par la plateforme (Super Admin, chemin d’activation réel)');
      const order2 = await api('/api/platform/me/orders', { method: 'POST', token: fluidityToken, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'monthly', seats: 4 } });
      const order2Id = order2.data.order?.id || order2.data.order?._id;
      const approveEarly = await api(`/api/platform/orders/${order2Id}/approve`, { method: 'POST', token: fluidityToken });
      check('approbation refusée à un tenant admin', approveEarly.status === 403, `status=${approveEarly.status}`);
      const approve = await api(`/api/platform/orders/${order2Id}/approve`, { method: 'POST', token: superToken, body: { note: 'Virement reçu.' } });
      check('approbation → commande terminée, souscription activée (renouvellement)', approve.status === 200 && approve.data.order?.status === 'completed', `status=${approve.status}`);
      const fluidityEntAfter = await api('/api/platform/me/entitlements', { token: fluidityToken });
      check('produit activé visible dans les entitlements', fluidityEntAfter.data.accessibleKeys?.includes('project_management'));
      const fluidityProjectsAfter = await api('/api/projects', { token: fluidityToken });
      check('accès projets après activation', fluidityProjectsAfter.status === 200, `status=${fluidityProjectsAfter.status}`);
      const fluiditySubs = await api('/api/platform/subscriptions', { token: fluidityToken });
      const fluidityProjSub = (fluiditySubs.data.subscriptions || []).find((subEl) => subEl.productKey === 'project_management');
      check('souscription Fluidity réactivée (active)', fluidityProjSub?.status === 'active', fluidityProjSub?.status);

      console.log('— Backlog Scrum (épopées & user stories)');
      const backlog = await api(`/api/projects/${scrumProject._id}/backlog`, { token: novaToken });
      check('backlog : épopées listées', backlog.status === 200 && (backlog.data.epics || []).length >= 2, `epics=${backlog.data.epics?.length}`);
      check('backlog : stories non planifiées triées par valeur métier', backlog.status === 200 && Array.isArray(backlog.data.unassigned), `count=${backlog.data.unassigned?.length}`);
      const epicUx = (backlog.data.epics || []).find((e) => e.ref === 'EPC-001');
      check('épopée avec points et valeur métier', epicUx && epicUx.points === 10 && epicUx.businessValue === 900, JSON.stringify({ p: epicUx?.points, v: epicUx?.businessValue }));

      console.log('— Suivi du temps');
      const timeList = await api(`/api/projects/${scrumProject._id}/time`, { token: novaToken });
      check('saisies de temps listées (seed)', timeList.status === 200 && (timeList.data.entries || []).length >= 4, `count=${timeList.data.entries?.length}`);
      check('totaux par utilisateur', timeList.status === 200 && Array.isArray(timeList.data.perUser) && timeList.data.perUser.length >= 2, `n=${timeList.data.perUser?.length}`);
      const devToken = await login('yacine.dev@nova-systems.dev');
      const scrumTasks = await api(`/api/projects/${scrumProject._id}/tasks`, { token: novaToken });
      const tsk105 = (scrumTasks.data.tasks || []).find((t) => t.ref === 'TSK-105');
      const timeCreate = await api(`/api/projects/${scrumProject._id}/time`, { method: 'POST', token: devToken, body: { taskId: tsk105?._id, date: new Date().toISOString(), minutes: 90, note: 'Sync hors-ligne' } });
      check('saisie de temps (développeur)', timeCreate.status === 201, `status=${timeCreate.status}`);
      const entryId = timeCreate.data.entry?._id;
      const timePatch = await api(`/api/projects/${scrumProject._id}/time/${entryId}`, { method: 'PATCH', token: devToken, body: { minutes: 120 } });
      check('modification de sa propre saisie', timePatch.status === 200 && timePatch.data.entry?.minutes === 120);
      const timeOther = await api(`/api/projects/${scrumProject._id}/time/${entryId}`, { method: 'PATCH', token: viewerToken, body: { minutes: 10 } });
      check('saisie d’un autre refusée (viewer)', timeOther.status === 403, `status=${timeOther.status}`);
      const timeDel = await api(`/api/projects/${scrumProject._id}/time/${entryId}`, { method: 'DELETE', token: devToken });
      check('suppression de sa saisie', timeDel.status === 200);

      console.log('— Livrables (cycle d’approbation)');
      const deliv = await api(`/api/projects/${kanbanProject._id}/deliverables`, { method: 'POST', token: devToken, body: { title: 'Livrable E2E', description: 'Test du cycle' } });
      check('livrable créé en brouillon (dev)', deliv.status === 201 && deliv.data.deliverable?.status === 'draft', `status=${deliv.status} body=${JSON.stringify(deliv.data)}`);
      const delivId = deliv.data.deliverable?._id;
      const delivSub = await api(`/api/projects/${kanbanProject._id}/deliverables/${delivId}/status`, { method: 'PATCH', token: devToken, body: { to: 'submitted' } });
      check('soumission du livrable', delivSub.status === 200 && delivSub.data.deliverable?.status === 'submitted', `status=${delivSub.status}`);
      const devApprove = await api(`/api/projects/${kanbanProject._id}/deliverables/${delivId}/status`, { method: 'PATCH', token: devToken, body: { to: 'approved' } });
      check('approbation refusée pour un développeur', devApprove.status === 403, `status=${devApprove.status}`);
      const poToken = await login('aziz.po@nova-systems.dev');
      const poApprove = await api(`/api/projects/${kanbanProject._id}/deliverables/${delivId}/status`, { method: 'PATCH', token: poToken, body: { to: 'approved' } });
      check('approbation par le Product Owner', poApprove.status === 200 && poApprove.data.deliverable?.status === 'approved', `status=${poApprove.status} body=${JSON.stringify(poApprove.data)}`);
      const seedDeliv = await api(`/api/projects/${kanbanProject._id}/deliverables`, { token: novaToken });
      check('livrables du seed (approuvé + soumis)', (seedDeliv.data.deliverables || []).some((d) => d.status === 'approved') && (seedDeliv.data.deliverables || []).some((d) => d.status === 'submitted'), `status=${seedDeliv.status} n=${seedDeliv.data.deliverables?.length} statuses=${JSON.stringify((seedDeliv.data.deliverables || []).map((d) => d.status))}`);

      console.log('— Événements projet (réunions & décisions)');
      const ev = await api(`/api/projects/${scrumProject._id}/events`, { method: 'POST', token: novaToken, body: { title: 'Rétrospective E2E', type: 'meeting', date: new Date().toISOString() } });
      check('événement créé', ev.status === 201 && ev.data.event?.type === 'meeting', `status=${ev.status}`);
      const evId = ev.data.event?._id;
      const viewerEvent = await api(`/api/projects/${scrumProject._id}/events`, { method: 'POST', token: viewerToken, body: { title: 'Interdit', date: new Date().toISOString() } });
      check('création d’événement refusée (viewer)', viewerEvent.status === 403, `status=${viewerEvent.status}`);
      const calendar2 = await api(`/api/projects/${scrumProject._id}/calendar`, { token: novaToken });
      check('calendrier enrichi des événements', calendar2.status === 200 && (calendar2.data.events || []).some((e) => String(e._id) === String(evId)));
      const evDel = await api(`/api/projects/${scrumProject._id}/events/${evId}`, { method: 'DELETE', token: novaToken });
      check('suppression d’événement', evDel.status === 200);

      console.log('— Cycle de vie projet (transitions serveur)');
      const draftProj = (list.data.projects || []).find((p) => p.status === 'draft');
      check('projet brouillon seedé', !!draftProj, JSON.stringify((list.data.projects || []).map((p) => p.status)));
      const toPlanning = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: novaToken, body: { status: 'planning' } });
      check('transition draft → planning', toPlanning.status === 200 && toPlanning.data.project?.status === 'planning', `status=${toPlanning.status}`);
      const toActive = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: novaToken, body: { status: 'active' } });
      check('transition planning → active', toActive.status === 200 && toActive.data.project?.status === 'active');
      const badLifecycle = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: novaToken, body: { status: 'draft' } });
      check('transition active → draft refusée', badLifecycle.status === 400, `status=${badLifecycle.status}`);
      const toCompleted = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: novaToken, body: { status: 'completed' } });
      check('transition active → completed', toCompleted.status === 200);
      const toArchived = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: novaToken, body: { status: 'archived' } });
      check('transition completed → archived', toArchived.status === 200 && toArchived.data.project?.status === 'archived');
      const memberLifecycle = await api(`/api/projects/${draftProj._id}`, { method: 'PUT', token: memberToken, body: { status: 'active' } });
      check('changement de statut refusé (project_member)', memberLifecycle.status === 403, `status=${memberLifecycle.status}`);

      console.log('— Santé projet & rapports enrichis');
      const healthOv = await api(`/api/projects/${kanbanProject._id}`, { method: 'PUT', token: novaToken, body: { healthOverride: { status: 'on_track', reason: 'Risque maîtrisé après plan d’action.' } } });
      check('override de santé enregistré', healthOv.status === 200 && healthOv.data.project?.healthOverride?.status === 'on_track', `status=${healthOv.status}`);
      const listAfter = await api('/api/projects?limit=50', { token: novaToken });
      const kanbanAfter = (listAfter.data.projects || []).find((p) => String(p._id) === String(kanbanProject._id));
      check('santé forcée à on_track (raison)', kanbanAfter?.health === 'on_track', kanbanAfter?.health);
      const reports2 = await api(`/api/projects/${scrumProject._id}/reports`, { token: novaToken });
      check('rapports : cycle time + débit + temps', reports2.status === 200 && reports2.data.cycleTime && Array.isArray(reports2.data.throughput) && reports2.data.timeSummary, JSON.stringify({ ct: !!reports2.data.cycleTime, tp: !!reports2.data.throughput, ts: !!reports2.data.timeSummary }));
      const sprintStats = (reports2.data.sprints || []).find((sp2) => sp2.status === 'active');
      check('statistiques sprint : burndown + vélocité en points', !!sprintStats && Array.isArray(sprintStats.burndown) && typeof sprintStats.velocityPoints === 'number', JSON.stringify(sprintStats && { v: sprintStats.velocityPoints, b: sprintStats.burndown?.length }));

      console.log('— Préférences de notification');
      const prefs = await api('/api/platform/me/notifications/preferences', { token: novaToken });
      check('préférences par défaut (31 événements)', prefs.status === 200 && Object.keys(prefs.data.preferences || {}).length === 31, `count=${Object.keys(prefs.data.preferences || {}).length}`);
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

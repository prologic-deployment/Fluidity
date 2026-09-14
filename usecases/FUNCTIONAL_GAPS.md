# FUNCTIONAL GAPS (A5)

## Critical gaps

### GAP-01 — Tenant Admin can create/promote PLATFORM_ADMIN via API

**Severity:** Critical

**Affected role(s):** TENANT_ADMIN

**Affected product:** Platform (user management)

**Expected:** Only PLATFORM_ADMIN can grant the PLATFORM_ADMIN role.

**Actual:** POST/PATCH /api/users accept any enum role incl. PLATFORM_ADMIN; UI dropdown (APP_ROLES) hides it, so a direct API call escalates (Case 14).

**Frontend evidence:** frontend/src/app/models/user.model.ts APP_ROLES (no PLATFORM_ADMIN); users-dashboard role selects

**Backend evidence:** backend/src/controllers/user.controller.js createUser (role = req.body.role), updateUser (user.role = role) — no PLATFORM_ADMIN guard

**Impact:** Full platform compromise from any tenant admin account.

**Recommended fix:** Reject role=PLATFORM_ADMIN unless req.userRole is PLATFORM_ADMIN (403 ROLE_ESCALATION_DENIED) in both handlers.

---

### GAP-02 — ServiceDesk product roles/permissions have zero enforcement effect

**Severity:** Critical

**Affected role(s):** servicedesk_admin, service_manager, support_n1, support_n2, requester, servicedesk_viewer

**Affected product:** ServiceDesk

**Expected:** Assigning a servicedesk_* role changes what the user can do; servicedesk.* permissions gate APIs.

**Actual:** No backend file (outside the registry) references any servicedesk.* permission; no controller reads req.productEntry/roleKey. All ServiceDesk auth uses internal roles (refuseViewer, requireRole, canTransition(userRole)) + subscription/license presence. RoleAssignment for servicedesk is stored, mailed (product_role_changed) and displayed — but changes nothing (Case 11).

**Frontend evidence:** subscriptions-licenses.component.ts (assign UI); platform.service.assignRole

**Backend evidence:** backend/src/products/registry.js (definitions only); ticket/demande/changement/contrat/client controllers (internal-role checks); authorization.service resolveProductAccess called WITHOUT permission for servicedesk

**Impact:** Tenant admins believe they delegated ServiceDesk powers; in reality AGENT vs MANAGER powers come from the internal role. Least-privilege impossible at product level.

**Recommended fix:** Either enforce servicedesk.* permissions in controllers (requireProductAccess(servicedesk, perm) per route + transition-permission mapping) or remove servicedesk roles from the assignable catalog with a deprecation note.

---

## High gaps

### GAP-03 — Roles/views beyond servicedesk+project_management are placeholder-only

**Severity:** High

**Affected role(s):** 57 roles in 15 coming_soon products

**Affected product:** fleet/hr/crm/contracts/assets/knowledge/monitoring/backup/security/documents/BI/AI/procurement/time/collaboration

**Expected:** Marketplace products are usable after purchase.

**Actual:** available=false → 409 PRODUCT_NOT_AVAILABLE on order; only route is /apps/:key placeholder behind productAccessGuard. Registry roles/permissions/workflows exist but no backend module and no UI (Case 4/5).

**Frontend evidence:** frontend/src/app/app.routes.ts (apps/:productKey → ProductPlaceholderComponent)

**Backend evidence:** backend/src/products/registry.js (status coming_soon, available=false); platform.route POST /me/orders effectiveAvailability gate

**Impact:** Catalog advertises 17 products; 15 cannot be bought or used. Honest placeholder, but a functional gap vs. the catalog promise.

**Recommended fix:** Keep status honest in UI (already “coming soon”); implement or hide purchase affordances per product.

---

## Medium gaps

### GAP-04 — 3 notification events sent but not configurable (prefs mismatch)

**Severity:** Medium

**Affected role(s):** all recipients

**Affected product:** Notifications

**Expected:** Every emitted event is listed in GET preferences and honored by PATCH.

**Actual:** DEFAULT_PREFS lacks milestone_completed, product_role_changed, product_role_removed; PATCH sanitizes unknown keys out; frontend PROJECT_EVENTS includes them so the UI offers toggles that never persist.

**Frontend evidence:** frontend/src/app/components/subscriptions/subscriptions-overview.component.ts PROJECT_EVENTS

**Backend evidence:** backend/src/routes/platform.route.js DEFAULT_PREFS; backend/src/models/project.models.js PROJECT_NOTIFICATION_EVENTS (also stale)

**Impact:** Users cannot mute 3 event types; UI implies control it does not have.

**Recommended fix:** Add the 3 events to DEFAULT_PREFS (+ model enum) with {email:true,inapp:true}.

---

### GAP-05 — 9 project permissions defined but never enforced (vestigial)

**Severity:** Medium

**Affected role(s):** all project_management roles

**Affected product:** Project Management

**Expected:** Every registry permission gates at least one API or UI check.

**Actual:** project.admin, project.activity.read, project.backlog.manage, project.deliverable.manage, project.file.manage, project.health.override, project.milestone.read, project.report.export, project.task.comment appear ONLY in registry.js (approval.manage/time.manage only in comments). Governing checks use coarser perms + CAN ranks instead. Consequences: no report export endpoint at all; updateProject accepts healthOverride without the override perm; file upload needs only rank>=1.

**Frontend evidence:** — (none referenced)

**Backend evidence:** backend/src/products/registry.js vs routes/project.route.js + project.*.controller.js

**Impact:** Permission catalog over-promises; two concrete holes (export missing, healthOverride unguarded).

**Recommended fix:** Enforce or remove: add export endpoint or drop the perm; check health.override in updateProject; document rank-based governance for the rest.

---

### GAP-06 — Time-entry management contradicts its own documented rule

**Severity:** Medium

**Affected role(s):** project_lead, product_owner, scrum_master

**Affected product:** Project Management (time)

**Expected:** Own entry, or project.time.manage (per controller comments).

**Actual:** PATCH/DELETE /time/:entryId routes require project.time.log, which lead/PO/scrum lack; controller then allows own-or-rank>=3. Net: those ranks cannot manage others’ entries at all (403 at route), despite rank>=3 and (lead) holding time.manage.

**Frontend evidence:** project-time.component (no gating; API errors)

**Backend evidence:** backend/src/routes/project.route.js (time.log on PATCH/DELETE); backend/src/controllers/project.time.controller.js comments vs code

**Impact:** Leads cannot correct their team’s time entries.

**Recommended fix:** Require time.log OR time.manage at route (custom middleware) to match the documented rule.

---

### GAP-07 — Project update has no rank check — product perm bypasses membership

**Severity:** Medium

**Affected role(s):** project_manager (product role), project_admin

**Affected product:** Project Management

**Expected:** Only project members with rank>=5 (or admins) update project settings.

**Actual:** PUT /api/projects/:id checks route perm (admin/manager product roles) + guardProjectRole only. A non-member holding product role project_manager can update any tenant-visible project (name, methodology, visibility, healthOverride…). Settings UI hides the form (myRole gate) but the API allows it (Case 14).

**Frontend evidence:** frontend/src/app/components/projects/project-settings.component.ts canManage (myRole-based hide)

**Backend evidence:** backend/src/controllers/project.controller.js updateProject (no can() check)

**Impact:** Settings/methodology/visibility tampering by non-members with a privileged product role.

**Recommended fix:** Add can(role, CAN.manageProject) to updateProject (keep tenant/platform admin bypass via resolveProjectRole).

---

## Low gaps

### GAP-08 — Backlog create buttons shown to scrum_master, API rejects

**Severity:** Low

**Affected role(s):** scrum_master

**Affected product:** Project Management (backlog)

**Expected:** UI affordances match API authorization.

**Actual:** Backlog canManage includes scrum_master, but POST /tasks requires project.task.create which scrum_master lacks → 403 on click (Case 1).

**Frontend evidence:** frontend/src/app/components/projects/project-backlog.component.ts:70

**Backend evidence:** backend/src/routes/project.route.js POST /:id/tasks (project.task.create)

**Impact:** UX-only: confusing 403 for scrum masters.

**Recommended fix:** Remove scrum_master from backlog canManage OR grant project.task.create to scrum_master (decide intended workflow).

---

### GAP-09 — Task status changes skip the rank check that full edits require

**Severity:** Low

**Affected role(s):** project_member, stakeholder(viewer lacks perm)

**Affected product:** Project Management (tasks)

**Expected:** Consistent rank bar across task mutation paths.

**Actual:** PATCH .../status|move|checklist need only project.task.update + guard (rank-1 member OK, workflow rules apply); PUT .../:taskId needs rank>=2 or assignee. A rank-1 member can drag cards through the board but cannot edit the same task’s title.

**Frontend evidence:** project-board.component (no gating)

**Backend evidence:** backend/src/controllers/project.task.controller.js transitionTask/moveTask/updateChecklist (no can()) vs updateTask (CAN.updateTasks)

**Impact:** Minor inconsistency; arguably intended (board fluidity) but undocumented.

**Recommended fix:** Document as intended, or align bars.

---

### GAP-10 — Missing UI for existing APIs (backend-only surface)

**Severity:** Low

**Affected role(s):** TENANT_ADMIN, PLATFORM_ADMIN, members

**Affected product:** Platform + Projects

**Expected:** Every API is reachable from UI or documented as API-only.

**Actual:** No UI: POST cancel-request (no service method at all), PATCH subscriptions/:id (updateSubscription unused), GET roles/matrix (roleMatrix unused), GET /projects/search (search unused), PUT comments/:id (updateComment unused → comments deletable but not editable in UI), PUT sprints/:id (updateSprint unused).

**Frontend evidence:** frontend/src/app/services/platform.service.ts, project.service.ts (unused methods verified by call-scan)

**Backend evidence:** backend/src/routes/platform.route.js, project.route.js

**Impact:** Features paid for but unusable without direct API calls; tenant audit readable via API but invisible in UI.

**Recommended fix:** Add UI (tenant audit view, edit-comment, edit-sprint, global search) or mark endpoints API-only in docs.

---

### GAP-11 — Orphan / dead frontend surface

**Severity:** Low

**Affected role(s):** PLATFORM_ADMIN, CLIENT

**Affected product:** Platform + ServiceDesk

**Expected:** Every route is reachable; guards used consistently.

**Actual:** /plateforme/saas route exists with zero sidebar/routerLink references (orphan, URL-only for platform admins). productPermissionGuard is exported but used on ZERO routes (no route-level permission gating anywhere; only product-level + component-level). CLIENTs can legally list own contrats via API but sidebar hides /contrats (Case 2).

**Frontend evidence:** frontend/src/app/app.routes.ts; guards/product-access.guard.ts; components/shell/sidebar.component.ts

**Backend evidence:** backend/src/controllers/contrat.controller.js (CLIENT scoping implemented server-side)

**Impact:** Dead code + one hidden-but-legal page.

**Recommended fix:** Link or remove /plateforme/saas; adopt productPermissionGuard on sensitive child routes; show /contrats to CLIENTs (scoped) or document the hiding.

---

### GAP-12 — ServiceDesk emails broadcast to AGENT+TENANT_ADMIN only (no targeting, no in-app)

**Severity:** Low

**Affected role(s):** AGENT, TENANT_ADMIN, MANAGER, CLIENT, assignees

**Affected product:** ServiceDesk notifications

**Expected:** Assignee/recipient-targeted notifications, in-app + email.

**Actual:** Ticket/demande/changement events call sendSupportEmail → ALL AGENT + TENANT_ADMIN users of the tenant. MANAGERs and CLIENTs get nothing; assignees get nothing specific; zero Notification (in-app) records for ServiceDesk.

**Frontend evidence:** — (no ServiceDesk notification surface)

**Backend evidence:** backend/src/services/email.service.js sendSupportEmail; ticket/demande/changement controllers notifier() calls

**Impact:** Noisy for agents; silent for managers/clients/assignees.

**Recommended fix:** Route ServiceDesk events through project-notify.service (Notification + prefs + targeted email) like the project module.

---

### GAP-13 — 3 notification events defined but never emitted

**Severity:** Low

**Affected role(s):** all

**Affected product:** Notifications

**Expected:** Every event in EVENT_I18N / email templates / prefs has at least one emitter.

**Actual:** time_logged, subscription_renewal have zero emitters (grep over controllers/routes/jobs/services); subscription_purchase is emitted NOWHERE at runtime — it appears only as a static demo row in project.seed.js. Templates + i18n + prefs keys exist, so the UI offers toggles for notifications that can never arrive.

**Frontend evidence:** PROJECT_EVENTS toggles (subscriptions-overview)

**Backend evidence:** backend/src/services/project-notify.service.js EVENT_I18N; backend/src/services/project-email.service.js TEMPLATES; backend/src/seed/project.seed.js:712 (demo only)

**Impact:** Dead UI toggles; time-logging produces activity but no notification despite the template.

**Recommended fix:** Emit time_logged on time entry creation (watchers/assignee), or remove dead events from EVENT_I18N/TEMPLATES/prefs.

---

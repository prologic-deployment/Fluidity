# Pages & navigation: project_lead

Sidebar: **Projects** group (`/projets`, `/projets/mes-taches`) iff `canAccess("project_management")` (licensed). Product switcher lists licensed products. All project tabs share ONE guard: `productAccessGuard` (product access, no permission check) — every tab below is VISIBLE to this role; actions inside are API-gated (only Team/Backlog/Settings/Deliverables/Dashboard-create add component gates).

| Tab | Route | Visible | Enabled actions for this role |
|---|---|---|---|
| Dashboard | /projets | Yes (guard: product access) | ✅ List projects |
| New project | /projets/nouveau | Yes (guard: product access) | ❌ Create project |
| My tasks | /projets/mes-taches | Yes (guard: product access) | ✅ View personal dashboard (my tasks) |
| Overview | /projets/:id | Yes (guard: product access) | ✅ View project detail<br>✅ View project dashboard tab |
| Tasks | /projets/:id/taches | Yes (guard: product access) | ✅ List / board / get / backlog tasks<br>✅ Create task (+ optional assignee)<br>✅ Full task update (PUT)<br>❌ Delete task<br>✅ Edit task checklist<br>✅ Watch / unwatch task |
| Board | /projets/:id/board | Yes (guard: product access) | ✅ List / board / get / backlog tasks<br>✅ Change task status (transition/move) |
| Planning | /projets/:id/planning | Yes (guard: product access) | ✅ List / board / get / backlog tasks |
| Milestones | /projets/:id/jalons | Yes (guard: product access) | ✅ List milestones<br>❌ Create / update / delete milestone |
| Sprints | /projets/:id/sprints | Yes (guard: product access) | ✅ List sprints<br>❌ Create / start / complete / plan / delete sprint |
| Backlog | /projets/:id/backlog | Yes (guard: product access) | ✅ List / board / get / backlog tasks<br>✅ Create task (+ optional assignee) |
| Time | /projets/:id/temps | Yes (guard: product access) | ✅ List time entries<br>❌ Log time<br>❌ Edit / delete time entry |
| Deliverables | /projets/:id/livrables | Yes (guard: product access) | ✅ List deliverables<br>✅ Submit deliverable<br>◐ Approve / reject deliverable<br>❌ Delete deliverable |
| Meetings | /projets/:id/reunions | Yes (guard: product access) | ✅ List meetings/events<br>❌ Create / update / delete event |
| Team | /projets/:id/equipe | Yes (guard: product access) | ✅ List project members (+license flags)<br>❌ Search addable users<br>❌ Add member (auto-license; 409 if no seat)<br>❌ Change member role<br>❌ Remove member |
| Files | /projets/:id/fichiers | Yes (guard: product access) | ✅ List files<br>✅ Upload file<br>✅ Delete file |
| Activity | /projets/:id/activite | Yes (guard: product access) | ✅ Read activity journal |
| Risks | /projets/:id/risques | Yes (guard: product access) | ❌ Create / update / delete risk (+ read) |
| Issues | /projets/:id/problemes | Yes (guard: product access) | ❌ Create / update / delete issue (+ read) |
| Reports | /projets/:id/rapports | Yes (guard: product access) | ❌ View project reports |
| Calendar | /projets/:id/calendrier | Yes (guard: product access) | ✅ View project calendar |
| Settings | /projets/:id/parametres | Yes (guard: product access) | ❌ Update project settings<br>❌ Archive / unarchive project<br>✅ Read workflow config<br>❌ Update custom workflow |

Non-member, tenant-visible project: tabs visible, effective rank 0 (read-only); private project: 403 PROJECT_FORBIDDEN.

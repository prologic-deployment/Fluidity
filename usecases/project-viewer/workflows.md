# Workflows: project_viewer (rank 0)

```
Task lifecycle
❌ create (perm task.create + rank>=3) → assign (task.assign + rank>=3, member check)
❌ status flow (workflow rules; terminal may need task.complete) → watchers/assignee notified
❌ delete (task.delete + rank>=3)
```

```
Sprint & backlog
❌ create/start/complete sprint → team notified (sprint_started/completed)
❌ plan tasks into sprint
```

```
Team
❌ add member (license auto-provision; 409 LICENSE_REQUIRED if saturated) → invitee notified (project_invitation)
❌ change role → member notified (project_role_changed)
❌ remove
```

```
Milestone
❌ create → complete → whole team notified (milestone_completed) + audit
```

```
Deliverable
❌ submit (rank>=2) → manager notified → ❌ approve/reject (rank>=4) → submitter notified
```

```
Time
❌ log (rank>=2) → ❌ edit/delete (own or rank>=3; GAP-06 for lead/PO/scrum on others’ entries)
```

```
Project
❌ create (creator → project_admin) → ❌ settings (GAP-07: no rank check) → ❌ archive (rank>=5)
```

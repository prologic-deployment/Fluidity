# Notifications: TENANT_ADMIN

Channels: in-app `Notification` + localized email, per-event prefs (`{email,inapp}`, default all true) — except GAP-04 (3 events unconfigurable) and GAP-13 (3 dead events). ServiceDesk: broadcast email to AGENT+TENANT_ADMIN only (GAP-12).

| Event | Received when |
|---|---|
| subscription_approved / rejected | own order reviewed |
| subscription_expiring / expired | own subs (job; also to ALL licensed users) |
| license_limit_reached | seat saturation |
| ServiceDesk broadcast | every ticket/demande/changement create/transition/assign (email to all AGENT+TA) |
| project_* / task_* | if member/assignee/watcher |

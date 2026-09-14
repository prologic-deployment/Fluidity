# Notifications: VIEWER

Channels: in-app `Notification` + localized email, per-event prefs (`{email,inapp}`, default all true) — except GAP-04 (3 events unconfigurable) and GAP-13 (3 dead events). ServiceDesk: broadcast email to AGENT+TENANT_ADMIN only (GAP-12).

| Event | Received |
|---|---|
| ServiceDesk broadcast (create/assign/transition) | NO (GAP-12) |
| project/task events | if member/assignee/watcher (targeted in-app+email) |
| subscription/license events | license_assigned/removed (own); admin-only ones NO |

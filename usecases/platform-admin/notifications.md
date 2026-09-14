# Notifications: PLATFORM_ADMIN

Channels: in-app `Notification` + localized email, per-event prefs (`{email,inapp}`, default all true) — except GAP-04 (3 events unconfigurable) and GAP-13 (3 dead events). ServiceDesk: broadcast email to AGENT+TENANT_ADMIN only (GAP-12).

| Event | Received when | Channel |
|---|---|---|
| subscription_requested | any tenant submits an order | in-app + email |
| license_limit_reached | seat saturation (per trigger) | in-app + email |
| ServiceDesk broadcast | only as tenant member (AGENT/TA emails) — not by platform role | email |
| project_* / task_* | only if project member/assignee/watcher in impersonated tenant | in-app + email |

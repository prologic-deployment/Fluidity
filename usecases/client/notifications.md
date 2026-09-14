# Notifications: CLIENT

Channels: in-app `Notification` + localized email, per-event prefs (`{email,inapp}`, default all true) — except GAP-04 (3 events unconfigurable) and GAP-13 (3 dead events). ServiceDesk: broadcast email to AGENT+TENANT_ADMIN only (GAP-12).

| Event | Received |
|---|---|
| ServiceDesk broadcast | NO (AGENT+TA only — GAP-12) |
| project/license/subscription | NO (no access / not admin) |
| product_role_changed | NO (unassignable) |

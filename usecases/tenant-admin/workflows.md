# Workflows: TENANT_ADMIN

```
Purchase
catalog → order (seats/plan) → checkout (manual-approval mode) → pending_approval → [SA approves → Subscription active → notify TA] → assign licenses + roles → users notified → sidebar/placeholders update (refreshEntitlements)
```

```
User lifecycle
create (seat check vs tenant.maxUsers) → license(s) → product role(s) → [suspend ⇄ reactivate (seat re-check)] → 2FA reset / password reset; all audited; sessions revoked on security events
```

# Workflows: PLATFORM_ADMIN

```
Order review
pending_approval → review (?tenantId= detail) → approve (atomic findOneAndUpdate → Subscription active → licenses assignable → TA notified) / reject (motif → TA notified)
```

```
Product lifecycle (platform-managed)
create (draft, invisible) → configure (plans/roles/perms) → publish (needs ≥1 plan + ≥1 role) → [suspend ⇄ republish] → delete (draft + no history only)
```

```
Tenant ops
create → suspend (all access cut) ⇄ activate → delete; users managed via resolveTargetTenant (?tenantId=)
```

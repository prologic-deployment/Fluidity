# Workflows: service_manager

```
Assignment (the only real workflow)
TA assigns role → stored + audited → user notified (product_role_changed) → sidebar/entitlements refresh → NO behavior change (GAP-02)
```

```
ServiceDesk execution (role-independent)
internal role → refuseViewer/requireRole/canTransition(userRole) → effect; roleKey never read
```

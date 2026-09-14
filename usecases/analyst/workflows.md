# Workflows: analyst

```
Catalog → (blocked) purchase
browse /services → checkout → 409 PRODUCT_NOT_AVAILABLE (available=false)
```

```
SA-override edge (documented, unusual)
SA toggles override available=true → order → approve → sub → license → /apps/:key placeholder renders (module still absent)
```

```
Role assignment (effectless)
TA assigns → stored + audited + notified → no behavior change (nothing reads it)
```

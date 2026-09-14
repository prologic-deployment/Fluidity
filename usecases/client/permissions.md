# Permissions: CLIENT

| Mechanism | Rule |
|---|---|
| Principal | Client fiche (separate model, own password/tokenVersion) |
| Product access | servicedesk sub+license (seeded for active clients) or legacy |
| Reads | owner-scoped (filtreProprietaire; LEAK-001 neutral 404 on contrats) |
| Creates | tickets/demandes/changements: CLIENT-ONLY (staff 403) |
| Mutations | own tickets editable/commentable; assign denied; admin denied; /clients denied |
| Transitions | CLIENT-listed edges only |

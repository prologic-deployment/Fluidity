# Fluidity A5 — Role & Functional Use-Case Analysis

Branch `A5` @ `c0ff3dd` (2026-09-14). Code-verified reference: every claim traces to `frontend/src/…` or `backend/src/…`.

## Contents

| File | What |
|---|---|
| `ANALYSIS_REPORT.md` | Full report: architecture, roles, products, counts, issues, tenant isolation, PA-vs-TA |
| `ROLE_MATRIX.md` | Every (role × action) with status |
| `PRODUCT_ROLE_MATRIX.md` | Every (product × role) with access summary |
| `FUNCTIONAL_GAPS.md` | 13 gaps (2 critical) with evidence + fixes |
| `ROLE_OVERVIEW.mmd` / `ALL_USE_CASES.mmd` | Mermaid: role hierarchy / actors × UCs |
| `<role>/` | Per role: README, functional-use-cases, permissions, products, workflows, pages-and-navigation, notifications, use-case-diagram |

## Headline findings

- **6 internal/principal roles**: PLATFORM_ADMIN, TENANT_ADMIN, MANAGER, AGENT, VIEWER + CLIENT (portal principal, separate model).
- **17 products, 74 product roles** — but only **servicedesk + project_management** are orderable and functional; 15 are coming_soon placeholders (GAP-03).
- **ServiceDesk product roles are never enforced** — all ServiceDesk auth is internal-role based (GAP-02, Critical).
- **Tenant admin can mint PLATFORM_ADMIN via API** — UI hides it, API allows it (GAP-01, Critical).
- Project module: dual gate (product permission + project rank + membership) mostly consistent; 6 menores inconsistencies (GAP-05…09).
- Notifications: project module targeted (in-app+email, prefs); ServiceDesk = broadcast email to AGENT+TA only (GAP-12); 3 events unconfigurable (GAP-04); 3 dead (GAP-13).

## Role folders (80)

- `platform-admin/` — PLATFORM_ADMIN
- `tenant-admin/` — TENANT_ADMIN
- `manager/` — MANAGER
- `agent/` — AGENT
- `viewer/` — VIEWER
- `client/` — CLIENT
- `servicedesk-admin/` — servicedesk_admin @ servicedesk
- `service-manager/` — service_manager @ servicedesk
- `support-n1/` — support_n1 @ servicedesk
- `support-n2/` — support_n2 @ servicedesk
- `requester/` — requester @ servicedesk
- `servicedesk-viewer/` — servicedesk_viewer @ servicedesk
- `project-admin/` — project_admin @ project_management
- `project-manager/` — project_manager @ project_management
- `product-owner/` — product_owner @ project_management
- `scrum-master/` — scrum_master @ project_management
- `project-lead/` — project_lead @ project_management
- `developer/` — developer @ project_management
- `designer/` — designer @ project_management
- `qa/` — qa @ project_management
- `stakeholder/` — stakeholder @ project_management
- `project-member/` — project_member @ project_management
- `project-viewer/` — project_viewer @ project_management
- `fleet-admin/` — fleet_admin @ fleet_management
- `fleet-manager/` — fleet_manager @ fleet_management
- `fleet-operator/` — fleet_operator @ fleet_management
- `fleet-viewer/` — fleet_viewer @ fleet_management
- `hr-admin/` — hr_admin @ hr_center
- `hr-manager/` — hr_manager @ hr_center
- `hr-specialist/` — hr_specialist @ hr_center
- `employee/` — employee @ hr_center
- `hr-viewer/` — hr_viewer @ hr_center
- `crm-admin/` — crm_admin @ crm
- `sales-manager/` — sales_manager @ crm
- `sales/` — sales @ crm
- `sales-viewer/` — sales_viewer @ crm
- `contract-admin/` — contract_admin @ contract_management
- `contract-manager/` — contract_manager @ contract_management
- `contract-user/` — contract_user @ contract_management
- `contract-viewer/` — contract_viewer @ contract_management
- `asset-admin/` — asset_admin @ asset_management
- `asset-manager/` — asset_manager @ asset_management
- `asset-user/` — asset_user @ asset_management
- `asset-management-viewer/` — viewer @ asset_management
- `knowledge-admin/` — knowledge_admin @ knowledge_center
- `knowledge-center-editor/` — editor @ knowledge_center
- `contributor/` — contributor @ knowledge_center
- `knowledge-center-viewer/` — viewer @ knowledge_center
- `monitoring-admin/` — monitoring_admin @ monitoring
- `monitoring-manager/` — monitoring_manager @ monitoring
- `operator/` — operator @ monitoring
- `monitoring-viewer/` — viewer @ monitoring
- `backup-admin/` — backup_admin @ backup_management
- `backup-manager/` — backup_manager @ backup_management
- `backup-operator/` — backup_operator @ backup_management
- `backup-management-viewer/` — viewer @ backup_management
- `security-admin/` — security_admin @ security_center
- `security-manager/` — security_manager @ security_center
- `security-analyst/` — security_analyst @ security_center
- `security-viewer/` — security_viewer @ security_center
- `document-admin/` — document_admin @ document_management
- `document-manager/` — document_manager @ document_management
- `document-management-editor/` — editor @ document_management
- `document-management-viewer/` — viewer @ document_management
- `bi-admin/` — bi_admin @ business_intelligence
- `analyst/` — analyst @ business_intelligence
- `business-intelligence-viewer/` — viewer @ business_intelligence
- `ai-admin/` — ai_admin @ ai_assistant
- `ai-manager/` — ai_manager @ ai_assistant
- `ai-assistant-user/` — user @ ai_assistant
- `ai-assistant-viewer/` — viewer @ ai_assistant
- `procurement-admin/` — procurement_admin @ procurement
- `buyer/` — buyer @ procurement
- `procurement-viewer/` — procurement_viewer @ procurement
- `time-admin/` — time_admin @ time_tracking
- `time-manager/` — time_manager @ time_tracking
- `time-tracking-user/` — user @ time_tracking
- `collab-admin/` — collab_admin @ collaboration
- `member/` — member @ collaboration
- `collaboration-viewer/` — viewer @ collaboration

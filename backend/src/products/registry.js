/**
 * Registre des produits SaaS de la plateforme — SOURCE DE VÉRITÉ de la
 * configuration produit (métadonnées, plans, rôles, permissions, workflows).
 *
 * Architecture par registre : ajouter un produit = ajouter une entrée ici
 * (et éventuellement son module applicatif). Aucun `if (product === ...)`
 * dispersé dans le code : l'accès, les rôles, les permissions et les
 * workflows sont pilotés par ces définitions.
 *
 * Convention i18n : nameKey/descriptionKey/… sont des CLÉS de traduction
 * (jamais de libellés codés en dur). product.key est l'identifiant stable.
 */

/** Statuts commerciaux d'un produit. */
const PRODUCT_STATUS = { AVAILABLE: 'available', COMING_SOON: 'coming_soon' };

/**
 * Plans par produit — prix PAR UTILISATEUR PAR MOIS/AN (EUR).
 * Données configurables : aucun prix n'est « approuvé commercialement »,
 * ils sont pilotés par cette table (et, à terme, par la console admin).
 */
const PRICE_TABLE = {
  servicedesk: { starter: 9, business: 19, enterprise: 39 },
  project_management: { starter: 7, business: 15, enterprise: 32 },
  fleet_management: { starter: 8, business: 16, enterprise: 34 },
  hr_center: { starter: 6, business: 14, enterprise: 30 },
  crm: { starter: 12, business: 24, enterprise: 49 },
  contract_management: { starter: 8, business: 17, enterprise: 36 },
  asset_management: { starter: 7, business: 15, enterprise: 31 },
  knowledge_center: { starter: 5, business: 11, enterprise: 24 },
  monitoring: { starter: 10, business: 21, enterprise: 45 },
  backup_management: { starter: 9, business: 19, enterprise: 41 },
  security_center: { starter: 13, business: 27, enterprise: 55 },
  document_management: { starter: 6, business: 13, enterprise: 28 },
  business_intelligence: { starter: 14, business: 29, enterprise: 59 },
  ai_assistant: { starter: 16, business: 33, enterprise: 69 },
};

const PLANS = ['starter', 'business', 'enterprise'];

/** Rôles produit par défaut (clé stable → clés i18n + permissions). */
const DEFAULT_ROLES = {
  servicedesk: [
    { key: 'servicedesk_admin', nameKey: 'products.roles.servicedesk_admin' },
    { key: 'service_manager', nameKey: 'products.roles.service_manager' },
    { key: 'support_n1', nameKey: 'products.roles.support_n1' },
    { key: 'support_n2', nameKey: 'products.roles.support_n2' },
    { key: 'requester', nameKey: 'products.roles.requester' },
  ],
  project_management: [
    { key: 'project_admin', nameKey: 'products.roles.project_admin' },
    { key: 'project_manager', nameKey: 'products.roles.project_manager' },
    { key: 'project_lead', nameKey: 'products.roles.project_lead' },
    { key: 'project_member', nameKey: 'products.roles.project_member' },
    { key: 'project_viewer', nameKey: 'products.roles.project_viewer' },
  ],
  fleet_management: [
    { key: 'fleet_admin', nameKey: 'products.roles.fleet_admin' },
    { key: 'fleet_manager', nameKey: 'products.roles.fleet_manager' },
    { key: 'fleet_operator', nameKey: 'products.roles.fleet_operator' },
    { key: 'fleet_viewer', nameKey: 'products.roles.fleet_viewer' },
  ],
  hr_center: [
    { key: 'hr_admin', nameKey: 'products.roles.hr_admin' },
    { key: 'hr_manager', nameKey: 'products.roles.hr_manager' },
    { key: 'hr_specialist', nameKey: 'products.roles.hr_specialist' },
    { key: 'employee', nameKey: 'products.roles.employee' },
    { key: 'hr_viewer', nameKey: 'products.roles.hr_viewer' },
  ],
  crm: [
    { key: 'crm_admin', nameKey: 'products.roles.crm_admin' },
    { key: 'sales_manager', nameKey: 'products.roles.sales_manager' },
    { key: 'sales', nameKey: 'products.roles.sales' },
    { key: 'sales_viewer', nameKey: 'products.roles.sales_viewer' },
  ],
  contract_management: [
    { key: 'contract_admin', nameKey: 'products.roles.contract_admin' },
    { key: 'contract_manager', nameKey: 'products.roles.contract_manager' },
    { key: 'contract_user', nameKey: 'products.roles.contract_user' },
    { key: 'contract_viewer', nameKey: 'products.roles.contract_viewer' },
  ],
  knowledge_center: [
    { key: 'knowledge_admin', nameKey: 'products.roles.knowledge_admin' },
    { key: 'editor', nameKey: 'products.roles.editor' },
    { key: 'contributor', nameKey: 'products.roles.contributor' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  security_center: [
    { key: 'security_admin', nameKey: 'products.roles.security_admin' },
    { key: 'security_manager', nameKey: 'products.roles.security_manager' },
    { key: 'security_analyst', nameKey: 'products.roles.security_analyst' },
    { key: 'security_viewer', nameKey: 'products.roles.security_viewer' },
  ],
  monitoring: [
    { key: 'monitoring_admin', nameKey: 'products.roles.monitoring_admin' },
    { key: 'monitoring_manager', nameKey: 'products.roles.monitoring_manager' },
    { key: 'operator', nameKey: 'products.roles.operator' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  backup_management: [
    { key: 'backup_admin', nameKey: 'products.roles.backup_admin' },
    { key: 'backup_manager', nameKey: 'products.roles.backup_manager' },
    { key: 'backup_operator', nameKey: 'products.roles.backup_operator' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  document_management: [
    { key: 'document_admin', nameKey: 'products.roles.document_admin' },
    { key: 'document_manager', nameKey: 'products.roles.document_manager' },
    { key: 'editor', nameKey: 'products.roles.editor' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  business_intelligence: [
    { key: 'bi_admin', nameKey: 'products.roles.bi_admin' },
    { key: 'analyst', nameKey: 'products.roles.analyst' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  ai_assistant: [
    { key: 'ai_admin', nameKey: 'products.roles.ai_admin' },
    { key: 'ai_manager', nameKey: 'products.roles.ai_manager' },
    { key: 'user', nameKey: 'products.roles.user' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  asset_management: [
    { key: 'asset_admin', nameKey: 'products.roles.asset_admin' },
    { key: 'asset_manager', nameKey: 'products.roles.asset_manager' },
    { key: 'asset_user', nameKey: 'products.roles.asset_user' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
  procurement: [
    { key: 'procurement_admin', nameKey: 'products.roles.procurement_admin' },
    { key: 'buyer', nameKey: 'products.roles.buyer' },
    { key: 'procurement_viewer', nameKey: 'products.roles.procurement_viewer' },
  ],
  time_tracking: [
    { key: 'time_admin', nameKey: 'products.roles.time_admin' },
    { key: 'time_manager', nameKey: 'products.roles.time_manager' },
    { key: 'user', nameKey: 'products.roles.user' },
  ],
  collaboration: [
    { key: 'collab_admin', nameKey: 'products.roles.collab_admin' },
    { key: 'member', nameKey: 'products.roles.member' },
    { key: 'viewer', nameKey: 'products.roles.viewer' },
  ],
};

/** Workflow générique par défaut (états terminaux + transitions avec permission). */
function simpleWorkflow(productKey, states, transitions) {
  return {
    productKey,
    states: states.map((s, i) => ({
      key: s.key,
      nameKey: `products.workflows.${productKey}.states.${s.key}`,
      order: i,
      terminal: !!s.terminal,
    })),
    transitions: transitions.map((t) => ({
      from: t.from,
      to: t.to,
      action: t.action || `to_${t.to}`,
      actionKey: `products.workflows.${productKey}.actions.${t.action || `to_${t.to}`}`,
      requiredPermission: t.permission || null,
      notify: t.notify || false,
      conditions: t.conditions || [],
    })),
  };
}

/**
 * Définitions de workflows par produit. ServiceDesk reflète le moteur
 * existant (backend/src/utils/workflow.js + ticket workflow) ; les autres
 * produits définissent leur cycle de vie standard et extensible.
 */
const WORKFLOWS = {
  servicedesk: {
    productKey: 'servicedesk',
    // Aligné sur le moteur existant (statuts français stables) : le registre
    // est la vue « générique » ; le moteur réel reste source d'autorité.
    states: [
      { key: 'Nouveau' },
      { key: 'Affecté' },
      { key: "En cours d'analyse" },
      { key: 'En attente client' },
      { key: 'En attente tiers' },
      { key: 'En cours de résolution' },
      { key: 'Résolu' },
      // « Clôturé » n'est pas marqué terminal : la réouverture (Réouvert)
      // est une transition métier du ServiceDesk existant.
      { key: 'Clôturé' },
      { key: 'Réouvert' },
    ],
    transitions: [
      { from: 'Nouveau', to: 'Affecté', permission: 'servicedesk.ticket.assign', notify: true },
      { from: 'Affecté', to: "En cours d'analyse", permission: 'servicedesk.ticket.update' },
      { from: "En cours d'analyse", to: 'En cours de résolution', permission: 'servicedesk.ticket.update' },
      { from: 'En cours de résolution', to: 'Résolu', permission: 'servicedesk.ticket.resolve' },
      { from: 'Résolu', to: 'Clôturé', permission: 'servicedesk.ticket.close' },
      { from: 'Clôturé', to: 'Réouvert', permission: 'servicedesk.ticket.reopen' },
      { from: 'En cours d\'analyse', to: 'En attente client', permission: 'servicedesk.ticket.update', notify: true },
      { from: 'En attente client', to: "En cours d'analyse", permission: 'servicedesk.ticket.update' },
    ],
  },
  project_management: simpleWorkflow(
    'project_management',
    [
      { key: 'backlog' }, { key: 'todo' }, { key: 'in_progress' },
      { key: 'blocked' }, { key: 'review' }, { key: 'completed' }, { key: 'cancelled', terminal: true },
    ],
    [
      { from: 'backlog', to: 'todo', permission: 'project.task.update' },
      { from: 'todo', to: 'in_progress', permission: 'project.task.update' },
      { from: 'in_progress', to: 'blocked', permission: 'project.task.update' },
      { from: 'blocked', to: 'in_progress', permission: 'project.task.update' },
      { from: 'in_progress', to: 'review', permission: 'project.task.update' },
      { from: 'review', to: 'completed', permission: 'project.task.complete', notify: true },
      { from: 'review', to: 'in_progress', action: 'reopen', permission: 'project.task.update' },
      { from: 'completed', to: 'in_progress', action: 'reopen', permission: 'project.task.update' },
      { from: '*', to: 'cancelled', permission: 'project.task.update' },
    ]
  ),
  fleet_management: simpleWorkflow(
    'fleet_management',
    [
      { key: 'available' }, { key: 'assigned' }, { key: 'in_maintenance' },
      { key: 'lost' }, { key: 'retired', terminal: true }, { key: 'disposed', terminal: true },
    ],
    [
      { from: 'available', to: 'assigned', permission: 'fleet.asset.assign' },
      { from: 'assigned', to: 'available', permission: 'fleet.asset.assign' },
      { from: 'available', to: 'in_maintenance', permission: 'fleet.maintenance.create' },
      { from: 'in_maintenance', to: 'available', permission: 'fleet.maintenance.update' },
      { from: 'available', to: 'retired', permission: 'fleet.asset.update' },
      { from: 'available', to: 'disposed', permission: 'fleet.asset.update' },
      { from: 'assigned', to: 'lost', permission: 'fleet.asset.update' },
    ]
  ),
  hr_center: simpleWorkflow(
    'hr_center',
    [
      { key: 'candidate' }, { key: 'onboarding' }, { key: 'active' },
      { key: 'suspended' }, { key: 'offboarding' }, { key: 'inactive', terminal: true },
    ],
    [
      { from: 'candidate', to: 'onboarding', permission: 'hr.employee.update' },
      { from: 'onboarding', to: 'active', permission: 'hr.employee.update' },
      { from: 'active', to: 'suspended', permission: 'hr.employee.update' },
      { from: 'suspended', to: 'active', permission: 'hr.employee.update' },
      { from: 'active', to: 'offboarding', permission: 'hr.employee.update' },
      { from: 'offboarding', to: 'inactive', permission: 'hr.employee.update' },
    ]
  ),
  crm: simpleWorkflow(
    'crm',
    [
      { key: 'new' }, { key: 'qualified' }, { key: 'contacted' },
      { key: 'proposal' }, { key: 'negotiation' }, { key: 'won', terminal: true }, { key: 'lost', terminal: true },
    ],
    [
      { from: 'new', to: 'qualified', permission: 'crm.opportunity.update' },
      { from: 'qualified', to: 'contacted', permission: 'crm.opportunity.update' },
      { from: 'contacted', to: 'proposal', permission: 'crm.opportunity.update' },
      { from: 'proposal', to: 'negotiation', permission: 'crm.opportunity.update' },
      { from: 'negotiation', to: 'won', permission: 'crm.opportunity.close', notify: true },
      { from: 'negotiation', to: 'lost', permission: 'crm.opportunity.close' },
    ]
  ),
  contract_management: simpleWorkflow(
    'contract_management',
    [
      { key: 'draft' }, { key: 'review' }, { key: 'pending_signature' },
      { key: 'active' }, { key: 'expiring' }, { key: 'expired', terminal: true }, { key: 'terminated', terminal: true },
    ],
    [
      { from: 'draft', to: 'review', permission: 'contract.update' },
      { from: 'review', to: 'pending_signature', permission: 'contract.update' },
      { from: 'pending_signature', to: 'active', permission: 'contract.activate' },
      { from: 'active', to: 'expiring', permission: 'contract.update' },
      { from: 'active', to: 'terminated', permission: 'contract.update' },
    ]
  ),
  knowledge_center: simpleWorkflow(
    'knowledge_center',
    [
      { key: 'draft' }, { key: 'review' }, { key: 'published' }, { key: 'archived', terminal: true },
    ],
    [
      { from: 'draft', to: 'review', permission: 'knowledge.content.update' },
      { from: 'review', to: 'published', permission: 'knowledge.content.publish', notify: true },
      { from: 'published', to: 'archived', permission: 'knowledge.content.publish' },
    ]
  ),
  security_center: simpleWorkflow(
    'security_center',
    [
      { key: 'open' }, { key: 'triage' }, { key: 'investigating' },
      { key: 'mitigated' }, { key: 'resolved' }, { key: 'closed', terminal: true },
    ],
    [
      { from: 'open', to: 'triage', permission: 'security.incident.update' },
      { from: 'triage', to: 'investigating', permission: 'security.incident.update' },
      { from: 'investigating', to: 'mitigated', permission: 'security.incident.update' },
      { from: 'mitigated', to: 'resolved', permission: 'security.incident.resolve' },
      { from: 'resolved', to: 'closed', permission: 'security.incident.close' },
    ]
  ),
  monitoring: simpleWorkflow(
    'monitoring',
    [
      { key: 'operational' }, { key: 'degraded' }, { key: 'incident' }, { key: 'maintenance' },
    ],
    [
      { from: 'operational', to: 'degraded', permission: 'monitoring.alert.update' },
      { from: 'degraded', to: 'incident', permission: 'monitoring.alert.update' },
      { from: 'incident', to: 'operational', permission: 'monitoring.alert.resolve' },
      { from: 'operational', to: 'maintenance', permission: 'monitoring.manage' },
    ]
  ),
  backup_management: simpleWorkflow(
    'backup_management',
    [
      { key: 'scheduled' }, { key: 'running' }, { key: 'completed' },
      { key: 'failed' }, { key: 'restoring' }, { key: 'verified' },
    ],
    [
      { from: 'scheduled', to: 'running', permission: 'backup.run' },
      { from: 'running', to: 'completed', permission: 'backup.run' },
      { from: 'running', to: 'failed', permission: 'backup.run' },
      { from: 'completed', to: 'verified', permission: 'backup.verify' },
      { from: 'completed', to: 'restoring', permission: 'backup.restore' },
    ]
  ),
  document_management: simpleWorkflow(
    'document_management',
    [
      { key: 'draft' }, { key: 'review' }, { key: 'approved' }, { key: 'published' }, { key: 'archived' },
    ],
    [
      { from: 'draft', to: 'review', permission: 'document.update' },
      { from: 'review', to: 'approved', permission: 'document.approve' },
      { from: 'approved', to: 'published', permission: 'document.publish' },
      { from: 'published', to: 'archived', permission: 'document.manage' },
    ]
  ),
  business_intelligence: simpleWorkflow(
    'business_intelligence',
    [
      { key: 'draft' }, { key: 'scheduled' }, { key: 'published' }, { key: 'archived' },
    ],
    [
      { from: 'draft', to: 'scheduled', permission: 'bi.report.update' },
      { from: 'scheduled', to: 'published', permission: 'bi.report.publish' },
      { from: 'published', to: 'archived', permission: 'bi.report.manage' },
    ]
  ),
  ai_assistant: simpleWorkflow(
    'ai_assistant',
    [
      { key: 'draft' }, { key: 'training' }, { key: 'review' }, { key: 'published' }, { key: 'archived' },
    ],
    [
      { from: 'draft', to: 'training', permission: 'ai.assistant.update' },
      { from: 'training', to: 'review', permission: 'ai.assistant.update' },
      { from: 'review', to: 'published', permission: 'ai.assistant.publish' },
      { from: 'published', to: 'archived', permission: 'ai.assistant.manage' },
    ]
  ),
  asset_management: simpleWorkflow(
    'asset_management',
    [
      { key: 'new' }, { key: 'in_use' }, { key: 'in_repair' }, { key: 'retired', terminal: true },
    ],
    [
      { from: 'new', to: 'in_use', permission: 'asset.assign' },
      { from: 'in_use', to: 'in_repair', permission: 'asset.update' },
      { from: 'in_repair', to: 'in_use', permission: 'asset.update' },
      { from: 'in_use', to: 'retired', permission: 'asset.manage' },
    ]
  ),
  procurement: simpleWorkflow(
    'procurement',
    [
      { key: 'draft' }, { key: 'submitted' }, { key: 'approved' }, { key: 'ordered' }, { key: 'received' }, { key: 'cancelled', terminal: true },
    ],
    [
      { from: 'draft', to: 'submitted', permission: 'procurement.request.create' },
      { from: 'submitted', to: 'approved', permission: 'procurement.request.approve' },
      { from: 'approved', to: 'ordered', permission: 'procurement.request.update' },
      { from: 'ordered', to: 'received', permission: 'procurement.request.update' },
      { from: '*', to: 'cancelled', permission: 'procurement.request.create' },
    ]
  ),
  time_tracking: simpleWorkflow(
    'time_tracking',
    [
      { key: 'open' }, { key: 'in_progress' }, { key: 'submitted' }, { key: 'approved' }, { key: 'rejected' },
    ],
    [
      { from: 'open', to: 'in_progress', permission: 'time.entry.create' },
      { from: 'in_progress', to: 'submitted', permission: 'time.entry.create' },
      { from: 'submitted', to: 'approved', permission: 'time.entry.approve' },
      { from: 'submitted', to: 'rejected', permission: 'time.entry.approve' },
    ]
  ),
  collaboration: simpleWorkflow(
    'collaboration',
    [
      { key: 'active' }, { key: 'archived' },
    ],
    [
      { from: 'active', to: 'archived', permission: 'collaboration.space.manage' },
    ]
  ),
};

/** Catalogue complet — métadonnées publiques + config d'accès. */
const PRODUCTS = [
  {
    key: 'servicedesk',
    nameKey: 'products.servicedesk.name',
    taglineKey: 'products.servicedesk.tagline',
    descriptionKey: 'products.servicedesk.description',
    icon: 'ticket',
    emoji: '🎫',
    color: '#6366f1',
    status: PRODUCT_STATUS.AVAILABLE,
    category: 'operations',
    slug: 'servicedesk', // URL publique du service
    route: '/demandes', // entrée de l'application ServiceDesk (workflow existant)
    available: true,
    featuresKey: ['products.servicedesk.f1', 'products.servicedesk.f2', 'products.servicedesk.f3', 'products.servicedesk.f4'],
    benefitsKey: ['products.servicedesk.b1', 'products.servicedesk.b2', 'products.servicedesk.b3'],
    useCasesKey: ['products.servicedesk.u1', 'products.servicedesk.u2', 'products.servicedesk.u3'],
    related: ['monitoring', 'knowledge_center', 'backup_management'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.servicedesk[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.servicedesk[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.servicedesk,
    workflow: WORKFLOWS.servicedesk,
  },
  {
    key: 'project_management',
    nameKey: 'products.project_management.name',
    taglineKey: 'products.project_management.tagline',
    descriptionKey: 'products.project_management.description',
    icon: 'project',
    emoji: '📊',
    color: '#0ea5e9',
    status: PRODUCT_STATUS.AVAILABLE,
    category: 'collaboration',
    slug: 'project-management', // URL publique du service
    route: '/projets', // entrée de l'application Gestion de Projet
    available: true,
    featuresKey: ['products.project_management.f1', 'products.project_management.f2', 'products.project_management.f3', 'products.project_management.f4', 'products.project_management.f5', 'products.project_management.f6'],
    benefitsKey: ['products.project_management.b1', 'products.project_management.b2', 'products.project_management.b3'],
    useCasesKey: ['products.project_management.u1', 'products.project_management.u2', 'products.project_management.u3'],
    related: ['collaboration', 'time_tracking', 'business_intelligence'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.project_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.project_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.project_management,
    workflow: WORKFLOWS.project_management,
  },
  {
    key: 'fleet_management',
    nameKey: 'products.fleet_management.name',
    taglineKey: 'products.fleet_management.tagline',
    descriptionKey: 'products.fleet_management.description',
    icon: 'fleet',
    emoji: '🚚',
    color: '#f59e0b',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'operations',
    slug: 'fleet-management', // URL publique du service
    route: '/apps/fleet_management',
    available: false,
    featuresKey: ['products.fleet_management.f1', 'products.fleet_management.f2', 'products.fleet_management.f3', 'products.fleet_management.f4'],
    benefitsKey: ['products.fleet_management.b1', 'products.fleet_management.b2', 'products.fleet_management.b3'],
    useCasesKey: ['products.fleet_management.u1', 'products.fleet_management.u2', 'products.fleet_management.u3'],
    related: ['asset_management', 'procurement', 'monitoring'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.fleet_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.fleet_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.fleet_management,
    workflow: WORKFLOWS.fleet_management,
  },
  {
    key: 'hr_center',
    nameKey: 'products.hr_center.name',
    taglineKey: 'products.hr_center.tagline',
    descriptionKey: 'products.hr_center.description',
    icon: 'hr',
    emoji: '👥',
    color: '#ec4899',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'people',
    slug: 'hr-center', // URL publique du service
    route: '/apps/hr_center',
    available: false,
    featuresKey: ['products.hr_center.f1', 'products.hr_center.f2', 'products.hr_center.f3', 'products.hr_center.f4'],
    benefitsKey: ['products.hr_center.b1', 'products.hr_center.b2', 'products.hr_center.b3'],
    useCasesKey: ['products.hr_center.u1', 'products.hr_center.u2', 'products.hr_center.u3'],
    related: ['time_tracking', 'document_management', 'project_management'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.hr_center[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.hr_center[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.hr_center,
    workflow: WORKFLOWS.hr_center,
  },
  {
    key: 'crm',
    nameKey: 'products.crm.name',
    taglineKey: 'products.crm.tagline',
    descriptionKey: 'products.crm.description',
    icon: 'crm',
    emoji: '🤝',
    color: '#10b981',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'sales',
    slug: 'crm', // URL publique du service
    route: '/apps/crm',
    available: false,
    featuresKey: ['products.crm.f1', 'products.crm.f2', 'products.crm.f3', 'products.crm.f4'],
    benefitsKey: ['products.crm.b1', 'products.crm.b2', 'products.crm.b3'],
    useCasesKey: ['products.crm.u1', 'products.crm.u2', 'products.crm.u3'],
    related: ['business_intelligence', 'contract_management', 'ai_assistant'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.crm[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.crm[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.crm,
    workflow: WORKFLOWS.crm,
  },
  {
    key: 'contract_management',
    nameKey: 'products.contract_management.name',
    taglineKey: 'products.contract_management.tagline',
    descriptionKey: 'products.contract_management.description',
    icon: 'contract',
    emoji: '📄',
    color: '#8b5cf6',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'operations',
    slug: 'contracts', // URL publique du service
    route: '/apps/contract_management',
    available: false,
    featuresKey: ['products.contract_management.f1', 'products.contract_management.f2', 'products.contract_management.f3', 'products.contract_management.f4'],
    benefitsKey: ['products.contract_management.b1', 'products.contract_management.b2', 'products.contract_management.b3'],
    useCasesKey: ['products.contract_management.u1', 'products.contract_management.u2', 'products.contract_management.u3'],
    related: ['document_management', 'crm', 'security_center'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.contract_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.contract_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.contract_management,
    workflow: WORKFLOWS.contract_management,
  },
  {
    key: 'asset_management',
    nameKey: 'products.asset_management.name',
    taglineKey: 'products.asset_management.tagline',
    descriptionKey: 'products.asset_management.description',
    icon: 'asset',
    emoji: '💾',
    color: '#14b8a6',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'operations',
    slug: 'assets', // URL publique du service
    route: '/apps/asset_management',
    available: false,
    featuresKey: ['products.asset_management.f1', 'products.asset_management.f2', 'products.asset_management.f3', 'products.asset_management.f4'],
    benefitsKey: ['products.asset_management.b1', 'products.asset_management.b2', 'products.asset_management.b3'],
    useCasesKey: ['products.asset_management.u1', 'products.asset_management.u2', 'products.asset_management.u3'],
    related: ['fleet_management', 'procurement', 'monitoring'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.asset_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.asset_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.asset_management,
    workflow: WORKFLOWS.asset_management,
  },
  {
    key: 'knowledge_center',
    nameKey: 'products.knowledge_center.name',
    taglineKey: 'products.knowledge_center.tagline',
    descriptionKey: 'products.knowledge_center.description',
    icon: 'knowledge',
    emoji: '📚',
    color: '#f43f5e',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'collaboration',
    slug: 'knowledge', // URL publique du service
    route: '/apps/knowledge_center',
    available: false,
    featuresKey: ['products.knowledge_center.f1', 'products.knowledge_center.f2', 'products.knowledge_center.f3', 'products.knowledge_center.f4'],
    benefitsKey: ['products.knowledge_center.b1', 'products.knowledge_center.b2', 'products.knowledge_center.b3'],
    useCasesKey: ['products.knowledge_center.u1', 'products.knowledge_center.u2', 'products.knowledge_center.u3'],
    related: ['document_management', 'collaboration', 'ai_assistant'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.knowledge_center[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.knowledge_center[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.knowledge_center,
    workflow: WORKFLOWS.knowledge_center,
  },
  {
    key: 'monitoring',
    nameKey: 'products.monitoring.name',
    taglineKey: 'products.monitoring.tagline',
    descriptionKey: 'products.monitoring.description',
    icon: 'monitoring',
    emoji: '📡',
    color: '#22c55e',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'itops',
    slug: 'monitoring', // URL publique du service
    route: '/apps/monitoring',
    available: false,
    featuresKey: ['products.monitoring.f1', 'products.monitoring.f2', 'products.monitoring.f3', 'products.monitoring.f4'],
    benefitsKey: ['products.monitoring.b1', 'products.monitoring.b2', 'products.monitoring.b3'],
    useCasesKey: ['products.monitoring.u1', 'products.monitoring.u2', 'products.monitoring.u3'],
    related: ['servicedesk', 'backup_management', 'security_center'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.monitoring[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.monitoring[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.monitoring,
    workflow: WORKFLOWS.monitoring,
  },
  {
    key: 'backup_management',
    nameKey: 'products.backup_management.name',
    taglineKey: 'products.backup_management.tagline',
    descriptionKey: 'products.backup_management.description',
    icon: 'backup',
    emoji: '🗄️',
    color: '#3b82f6',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'itops',
    slug: 'backup', // URL publique du service
    route: '/apps/backup_management',
    available: false,
    featuresKey: ['products.backup_management.f1', 'products.backup_management.f2', 'products.backup_management.f3', 'products.backup_management.f4'],
    benefitsKey: ['products.backup_management.b1', 'products.backup_management.b2', 'products.backup_management.b3'],
    useCasesKey: ['products.backup_management.u1', 'products.backup_management.u2', 'products.backup_management.u3'],
    related: ['servicedesk', 'monitoring', 'security_center'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.backup_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.backup_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.backup_management,
    workflow: WORKFLOWS.backup_management,
  },
  {
    key: 'security_center',
    nameKey: 'products.security_center.name',
    taglineKey: 'products.security_center.tagline',
    descriptionKey: 'products.security_center.description',
    icon: 'security',
    emoji: '🛡️',
    color: '#ef4444',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'security',
    slug: 'security', // URL publique du service
    route: '/apps/security_center',
    available: false,
    featuresKey: ['products.security_center.f1', 'products.security_center.f2', 'products.security_center.f3', 'products.security_center.f4'],
    benefitsKey: ['products.security_center.b1', 'products.security_center.b2', 'products.security_center.b3'],
    useCasesKey: ['products.security_center.u1', 'products.security_center.u2', 'products.security_center.u3'],
    related: ['monitoring', 'backup_management', 'document_management'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.security_center[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.security_center[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.security_center,
    workflow: WORKFLOWS.security_center,
  },
  {
    key: 'document_management',
    nameKey: 'products.document_management.name',
    taglineKey: 'products.document_management.tagline',
    descriptionKey: 'products.document_management.description',
    icon: 'document',
    emoji: '📁',
    color: '#a855f7',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'collaboration',
    slug: 'documents', // URL publique du service
    route: '/apps/document_management',
    available: false,
    featuresKey: ['products.document_management.f1', 'products.document_management.f2', 'products.document_management.f3', 'products.document_management.f4'],
    benefitsKey: ['products.document_management.b1', 'products.document_management.b2', 'products.document_management.b3'],
    useCasesKey: ['products.document_management.u1', 'products.document_management.u2', 'products.document_management.u3'],
    related: ['knowledge_center', 'contract_management', 'collaboration'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.document_management[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.document_management[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.document_management,
    workflow: WORKFLOWS.document_management,
  },
  {
    key: 'business_intelligence',
    nameKey: 'products.business_intelligence.name',
    taglineKey: 'products.business_intelligence.tagline',
    descriptionKey: 'products.business_intelligence.description',
    icon: 'bi',
    emoji: '📈',
    color: '#06b6d4',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'analytics',
    slug: 'bi', // URL publique du service
    route: '/apps/business_intelligence',
    available: false,
    featuresKey: ['products.business_intelligence.f1', 'products.business_intelligence.f2', 'products.business_intelligence.f3', 'products.business_intelligence.f4'],
    benefitsKey: ['products.business_intelligence.b1', 'products.business_intelligence.b2', 'products.business_intelligence.b3'],
    useCasesKey: ['products.business_intelligence.u1', 'products.business_intelligence.u2', 'products.business_intelligence.u3'],
    related: ['crm', 'project_management', 'monitoring'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.business_intelligence[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.business_intelligence[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.business_intelligence,
    workflow: WORKFLOWS.business_intelligence,
  },
  {
    key: 'ai_assistant',
    nameKey: 'products.ai_assistant.name',
    taglineKey: 'products.ai_assistant.tagline',
    descriptionKey: 'products.ai_assistant.description',
    icon: 'ai',
    emoji: '🤖',
    color: '#d946ef',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'intelligence',
    slug: 'ai', // URL publique du service
    route: '/apps/ai_assistant',
    available: false,
    featuresKey: ['products.ai_assistant.f1', 'products.ai_assistant.f2', 'products.ai_assistant.f3', 'products.ai_assistant.f4'],
    benefitsKey: ['products.ai_assistant.b1', 'products.ai_assistant.b2', 'products.ai_assistant.b3'],
    useCasesKey: ['products.ai_assistant.u1', 'products.ai_assistant.u2', 'products.ai_assistant.u3'],
    related: ['knowledge_center', 'business_intelligence', 'crm'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.ai_assistant[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.ai_assistant[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.ai_assistant,
    workflow: WORKFLOWS.ai_assistant,
  },
  {
    key: 'procurement',
    nameKey: 'products.procurement.name',
    taglineKey: 'products.procurement.tagline',
    descriptionKey: 'products.procurement.description',
    icon: 'procurement',
    emoji: '🛒',
    color: '#64748b',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'operations',
    slug: 'procurement', // URL publique du service
    route: '/apps/procurement',
    available: false,
    featuresKey: ['products.procurement.f1', 'products.procurement.f2', 'products.procurement.f3', 'products.procurement.f4'],
    benefitsKey: ['products.procurement.b1', 'products.procurement.b2', 'products.procurement.b3'],
    useCasesKey: ['products.procurement.u1', 'products.procurement.u2', 'products.procurement.u3'],
    related: ['asset_management', 'contract_management', 'fleet_management'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.servicedesk[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.servicedesk[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.procurement,
    workflow: WORKFLOWS.procurement,
  },
  {
    key: 'time_tracking',
    nameKey: 'products.time_tracking.name',
    taglineKey: 'products.time_tracking.tagline',
    descriptionKey: 'products.time_tracking.description',
    icon: 'time',
    emoji: '⏱️',
    color: '#eab308',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'people',
    slug: 'time-tracking', // URL publique du service
    route: '/apps/time_tracking',
    available: false,
    featuresKey: ['products.time_tracking.f1', 'products.time_tracking.f2', 'products.time_tracking.f3', 'products.time_tracking.f4'],
    benefitsKey: ['products.time_tracking.b1', 'products.time_tracking.b2', 'products.time_tracking.b3'],
    useCasesKey: ['products.time_tracking.u1', 'products.time_tracking.u2', 'products.time_tracking.u3'],
    related: ['project_management', 'hr_center', 'collaboration'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.servicedesk[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.servicedesk[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.time_tracking,
    workflow: WORKFLOWS.time_tracking,
  },
  {
    key: 'collaboration',
    nameKey: 'products.collaboration.name',
    taglineKey: 'products.collaboration.tagline',
    descriptionKey: 'products.collaboration.description',
    icon: 'collab',
    emoji: '💬',
    color: '#84cc16',
    status: PRODUCT_STATUS.COMING_SOON,
    category: 'collaboration',
    slug: 'collaboration', // URL publique du service
    route: '/apps/collaboration',
    available: false,
    featuresKey: ['products.collaboration.f1', 'products.collaboration.f2', 'products.collaboration.f3', 'products.collaboration.f4'],
    benefitsKey: ['products.collaboration.b1', 'products.collaboration.b2', 'products.collaboration.b3'],
    useCasesKey: ['products.collaboration.u1', 'products.collaboration.u2', 'products.collaboration.u3'],
    related: ['project_management', 'document_management', 'knowledge_center'],
    plans: PLANS.map((p) => ({
      id: p,
      nameKey: `products.plans.${p}`,
      pricePerSeatMonthly: PRICE_TABLE.servicedesk[p],
      pricePerSeatAnnual: Math.round(PRICE_TABLE.servicedesk[p] * 10),
      currency: 'EUR',
    })),
    roles: DEFAULT_ROLES.collaboration,
    workflow: WORKFLOWS.collaboration,
  },
];

/** Permissions par défaut par produit (granulaires, préfixées produit.*). */
const PERMISSIONS_BY_PRODUCT = {
  servicedesk: [
    'servicedesk.ticket.create', 'servicedesk.ticket.read', 'servicedesk.ticket.update',
    'servicedesk.ticket.assign', 'servicedesk.ticket.escalate', 'servicedesk.ticket.resolve',
    'servicedesk.ticket.close', 'servicedesk.ticket.reopen',
    'servicedesk.demande.manage', 'servicedesk.changement.manage',
    'servicedesk.contract.read', 'servicedesk.client.read', 'servicedesk.admin',
  ],
  project_management: [
    'project.admin',
    'project.project.create', 'project.project.read', 'project.project.update', 'project.project.archive',
    'project.member.manage',
    'project.task.create', 'project.task.read', 'project.task.update', 'project.task.assign',
    'project.task.complete', 'project.task.delete', 'project.task.comment',
    'project.milestone.create', 'project.milestone.update', 'project.milestone.delete',
    'project.sprint.manage',
    'project.risk.manage', 'project.issue.manage',
    'project.file.manage',
    'project.report.read',
    'project.workflow.manage',
    'project.activity.read',
  ],
  fleet_management: [
    'fleet.asset.create', 'fleet.asset.read', 'fleet.asset.update', 'fleet.asset.assign',
    'fleet.maintenance.create', 'fleet.maintenance.update', 'fleet.inventory.read',
  ],
  hr_center: [
    'hr.employee.create', 'hr.employee.read', 'hr.employee.update',
    'hr.leave.create', 'hr.leave.approve', 'hr.leave.reject',
    'hr.document.read', 'hr.document.manage', 'hr.onboarding.manage',
  ],
  crm: [
    'crm.customer.create', 'crm.customer.read', 'crm.customer.update',
    'crm.opportunity.create', 'crm.opportunity.update', 'crm.opportunity.close',
  ],
  contract_management: [
    'contract.create', 'contract.read', 'contract.update', 'contract.activate',
    'contract.renew', 'contract.terminate',
  ],
  knowledge_center: [
    'knowledge.content.create', 'knowledge.content.read', 'knowledge.content.update',
    'knowledge.content.publish', 'knowledge.content.archive',
  ],
  security_center: [
    'security.incident.create', 'security.incident.read', 'security.incident.update',
    'security.incident.resolve', 'security.incident.close',
  ],
  monitoring: [
    'monitoring.dashboard.read', 'monitoring.alert.update', 'monitoring.alert.resolve', 'monitoring.manage',
  ],
  backup_management: [
    'backup.view', 'backup.run', 'backup.restore', 'backup.verify', 'backup.configure',
  ],
  document_management: [
    'document.create', 'document.read', 'document.update', 'document.approve', 'document.publish', 'document.manage',
  ],
  business_intelligence: [
    'bi.dashboard.read', 'bi.report.create', 'bi.report.read', 'bi.report.update', 'bi.report.publish', 'bi.report.manage',
  ],
  ai_assistant: [
    'ai.assistant.use', 'ai.assistant.create', 'ai.assistant.update', 'ai.assistant.publish', 'ai.assistant.manage',
  ],
  asset_management: [
    'asset.create', 'asset.read', 'asset.update', 'asset.assign', 'asset.manage',
  ],
  procurement: [
    'procurement.request.create', 'procurement.request.read', 'procurement.request.approve', 'procurement.request.update',
  ],
  time_tracking: [
    'time.entry.create', 'time.entry.read', 'time.entry.approve', 'time.report.read',
  ],
  collaboration: [
    'collaboration.space.create', 'collaboration.space.read', 'collaboration.space.update', 'collaboration.space.manage',
  ],
};

/** Rôles système par défaut → permissions (matrice simple et extensible). */
function rolePermissions(roleKey) {
  const map = {
    // ServiceDesk
    servicedesk_admin: ['servicedesk.admin', ...PERMISSIONS_BY_PRODUCT.servicedesk],
    service_manager: ['servicedesk.ticket.create', 'servicedesk.ticket.read', 'servicedesk.ticket.update', 'servicedesk.ticket.assign', 'servicedesk.ticket.escalate', 'servicedesk.demande.manage', 'servicedesk.contract.read'],
    support_n1: ['servicedesk.ticket.create', 'servicedesk.ticket.read', 'servicedesk.ticket.update', 'servicedesk.ticket.resolve', 'servicedesk.ticket.close'],
    support_n2: ['servicedesk.ticket.create', 'servicedesk.ticket.read', 'servicedesk.ticket.update', 'servicedesk.ticket.assign', 'servicedesk.ticket.resolve', 'servicedesk.ticket.escalate', 'servicedesk.ticket.close'],
    requester: ['servicedesk.ticket.create', 'servicedesk.ticket.read', 'servicedesk.ticket.reopen'],
    // Project
    project_admin: [...PERMISSIONS_BY_PRODUCT.project_management],
    project_manager: ['project.project.create', 'project.project.read', 'project.project.update', 'project.member.manage', 'project.task.create', 'project.task.read', 'project.task.update', 'project.task.assign', 'project.task.complete', 'project.task.delete', 'project.task.comment', 'project.milestone.create', 'project.milestone.update', 'project.milestone.delete', 'project.sprint.manage', 'project.risk.manage', 'project.issue.manage', 'project.file.manage', 'project.report.read', 'project.activity.read'],
    project_lead: ['project.project.read', 'project.task.create', 'project.task.read', 'project.task.update', 'project.task.assign', 'project.task.complete', 'project.task.comment', 'project.activity.read'],
    project_member: ['project.project.read', 'project.task.read', 'project.task.update', 'project.task.comment', 'project.file.manage'],
    project_viewer: ['project.project.read', 'project.task.read', 'project.activity.read', 'project.report.read'],
    // Fleet
    fleet_admin: [...PERMISSIONS_BY_PRODUCT.fleet_management],
    fleet_manager: ['fleet.asset.create', 'fleet.asset.read', 'fleet.asset.update', 'fleet.asset.assign', 'fleet.maintenance.create', 'fleet.maintenance.update'],
    fleet_operator: ['fleet.asset.read', 'fleet.asset.update', 'fleet.maintenance.create', 'fleet.maintenance.update'],
    fleet_viewer: ['fleet.asset.read', 'fleet.inventory.read'],
    // HR
    hr_admin: [...PERMISSIONS_BY_PRODUCT.hr_center],
    hr_manager: ['hr.employee.read', 'hr.employee.update', 'hr.leave.approve', 'hr.leave.reject', 'hr.document.read'],
    hr_specialist: ['hr.employee.read', 'hr.employee.update', 'hr.leave.create', 'hr.onboarding.manage'],
    employee: ['hr.employee.read', 'hr.leave.create', 'hr.document.read'],
    hr_viewer: ['hr.employee.read'],
    // CRM
    crm_admin: [...PERMISSIONS_BY_PRODUCT.crm],
    sales_manager: ['crm.customer.create', 'crm.customer.read', 'crm.customer.update', 'crm.opportunity.create', 'crm.opportunity.update', 'crm.opportunity.close'],
    sales: ['crm.customer.create', 'crm.customer.read', 'crm.customer.update', 'crm.opportunity.create', 'crm.opportunity.update'],
    sales_viewer: ['crm.customer.read', 'crm.opportunity.read'],
    // Contracts
    contract_admin: [...PERMISSIONS_BY_PRODUCT.contract_management],
    contract_manager: ['contract.create', 'contract.read', 'contract.update', 'contract.renew', 'contract.terminate'],
    contract_user: ['contract.read', 'contract.update'],
    contract_viewer: ['contract.read'],
    // Knowledge
    knowledge_admin: [...PERMISSIONS_BY_PRODUCT.knowledge_center],
    editor: ['knowledge.content.create', 'knowledge.content.read', 'knowledge.content.update', 'knowledge.content.publish'],
    contributor: ['knowledge.content.create', 'knowledge.content.read', 'knowledge.content.update'],
    viewer: ['knowledge.content.read'],
    // Security
    security_admin: [...PERMISSIONS_BY_PRODUCT.security_center],
    security_manager: ['security.incident.create', 'security.incident.read', 'security.incident.update', 'security.incident.resolve'],
    security_analyst: ['security.incident.read', 'security.incident.update'],
    security_viewer: ['security.incident.read'],
    // Monitoring
    monitoring_admin: [...PERMISSIONS_BY_PRODUCT.monitoring],
    monitoring_manager: ['monitoring.dashboard.read', 'monitoring.alert.update', 'monitoring.alert.resolve'],
    operator: ['monitoring.dashboard.read', 'monitoring.alert.update'],
    // Backup
    backup_admin: [...PERMISSIONS_BY_PRODUCT.backup_management],
    backup_manager: ['backup.view', 'backup.run', 'backup.restore', 'backup.verify'],
    backup_operator: ['backup.view', 'backup.run'],
    // Documents
    document_admin: [...PERMISSIONS_BY_PRODUCT.document_management],
    document_manager: ['document.create', 'document.read', 'document.update', 'document.approve', 'document.publish'],
    // BI
    bi_admin: [...PERMISSIONS_BY_PRODUCT.business_intelligence],
    analyst: ['bi.dashboard.read', 'bi.report.create', 'bi.report.read', 'bi.report.update', 'bi.report.publish'],
    // AI
    ai_admin: [...PERMISSIONS_BY_PRODUCT.ai_assistant],
    ai_manager: ['ai.assistant.use', 'ai.assistant.create', 'ai.assistant.update', 'ai.assistant.publish'],
    user: ['ai.assistant.use'],
    // Assets
    asset_admin: [...PERMISSIONS_BY_PRODUCT.asset_management],
    asset_manager: ['asset.create', 'asset.read', 'asset.update', 'asset.assign'],
    asset_user: ['asset.read', 'asset.update'],
    // Procurement
    procurement_admin: [...PERMISSIONS_BY_PRODUCT.procurement],
    buyer: ['procurement.request.create', 'procurement.request.read', 'procurement.request.update'],
    procurement_viewer: ['procurement.request.read'],
    // Time tracking
    time_admin: [...PERMISSIONS_BY_PRODUCT.time_tracking],
    time_manager: ['time.entry.read', 'time.entry.approve', 'time.report.read'],
    // Collaboration
    collab_admin: [...PERMISSIONS_BY_PRODUCT.collaboration],
    member: ['collaboration.space.create', 'collaboration.space.read', 'collaboration.space.update'],
  };
  return map[roleKey] || [];
}

/** Rôle produit par défaut d'un principal, selon son rôle interne actuel. */
function defaultProductRole(productKey, internalRole, principalType) {
  if (principalType === 'CLIENT') {
    if (productKey === 'servicedesk') return 'requester';
    return null;
  }
  switch (productKey) {
    case 'servicedesk':
      if (internalRole === 'PLATFORM_ADMIN' || internalRole === 'TENANT_ADMIN') return 'servicedesk_admin';
      if (internalRole === 'MANAGER') return 'service_manager';
      return internalRole === 'AGENT' ? 'support_n1' : 'viewer';
    case 'project_management':
      if (internalRole === 'PLATFORM_ADMIN' || internalRole === 'TENANT_ADMIN') return 'project_admin';
      if (internalRole === 'MANAGER') return 'project_manager';
      return internalRole === 'AGENT' ? 'project_lead' : 'project_viewer';
    default:
      return null;
  }
}

// --- Accès par registre ----------------------------------------------------

function getProduct(key) {
  return PRODUCTS.find((p) => p.key === key) || null;
}

function getProductByRoute(route) {
  return PRODUCTS.find((p) => p.route === route) || null;
}

function getWorkflow(productKey) {
  return WORKFLOWS[productKey] || null;
}

function getRole(productKey, roleKey) {
  const product = getProduct(productKey);
  return product?.roles?.find((r) => r.key === roleKey) || null;
}

function getPermissions(productKey) {
  return PERMISSIONS_BY_PRODUCT[productKey] || [];
}


/**
 * Valide une transition de workflow pour un produit donné — moteur générique
 * (états, transitions, permission requise, état terminal). Les futurs
 * produits l'utilisent sans réécrire la logique.
 *
 * Retourne { ok, reason } avec reason ∈
 *   'UNKNOWN_PRODUCT' | 'UNKNOWN_FROM' | 'UNKNOWN_TO' | 'TERMINAL_FROM'
 *   | 'TRANSITION_NOT_ALLOWED' | 'PERMISSION_DENIED'
 */
function canTransition(productKey, from, to, permissions = []) {
  const wf = WORKFLOWS[productKey];
  if (!wf) return { ok: false, reason: 'UNKNOWN_PRODUCT' };
  if (!wf.states.some((s) => s.key === from)) return { ok: false, reason: 'UNKNOWN_FROM' };
  if (!wf.states.some((s) => s.key === to)) return { ok: false, reason: 'UNKNOWN_TO' };
  const fromState = wf.states.find((s) => s.key === from);
  if (fromState?.terminal) return { ok: false, reason: 'TERMINAL_FROM' };
  const transition = wf.transitions.find((t) => t.to === to && (t.from === from || t.from === '*'));
  if (!transition) return { ok: false, reason: 'TRANSITION_NOT_ALLOWED' };
  if (transition.requiredPermission && !(permissions.includes('*') || permissions.includes(transition.requiredPermission))) {
    return { ok: false, reason: 'PERMISSION_DENIED' };
  }
  return { ok: true, reason: 'OK' };
}

module.exports = {
  PRODUCT_STATUS,
  PRODUCTS,
  PLANS,
  PRICE_TABLE,
  WORKFLOWS,
  PERMISSIONS_BY_PRODUCT,
  getProduct,
  getProductByRoute,
  getWorkflow,
  getRole,
  getPermissions,
  rolePermissions,
  defaultProductRole,
  simpleWorkflow,
  canTransition,
};

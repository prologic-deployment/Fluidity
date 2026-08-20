/**
 * Moteur de workflow (cycle de vie des statuts) pour les Demandes, les
 * Changements et les Tickets/Incidents — application MONO-ORGANISATION.
 *
 * Correspondance avec les groupes de rôles du référentiel A4-work :
 *   AGENT   → traitement opérationnel (SUPPORT_N1, EXPLOITATION)
 *   MANAGER → validation/pilotage (RESPONSABLE_TECHNIQUE, COMMERCIAL)
 *   CLIENT  → action du demandeur (réponse, clôture, annulation)
 *   ADMIN   → supervision (force une transition valide, comme PLATFORM_ADMIN/TENANT_ADMIN)
 *
 * Chaque statut liste les transitions sortantes autorisées, et pour
 * chacune, les rôles habilités. ADMIN peut forcer toute transition
 * DÉFINIE depuis un statut (supervision), SAUF depuis un état figé
 * (« Annulé », « Clôturé » / « Clôturée »).
 */

const AGENT_ROLES = ['SUPPORT_N1', 'EXPLOITATION'];
const MANAGER_ROLES = ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'];

// ---------------------------------------------------------------------
// DEMANDE — §2.2.2 (Statuts) + §2.2.3 (Workflow de traitement)
// ---------------------------------------------------------------------
const DEMANDE_STATUTS = [
  'Ouverte',
  "En cours d'analyse",
  'En attente de validation',
  'En cours de réalisation',
  'En attente client',
  'Rejetée',
  'Réalisée',
  'Clôturée',
  'Annulé',
];

/**
 * Statuts depuis lesquels le client propriétaire peut ANNULER sa demande
 * (avant que la réalisation ne démarre). Une fois annulée, la demande reste
 * en base mais sort définitivement du workflow.
 */
const DEMANDE_STATUTS_ANNULABLES = [
  'Ouverte',
  "En cours d'analyse",
  'En attente de validation',
  'En attente client',
];

const DEMANDE_TRANSITIONS = {
  Ouverte: [
    // Étape 2 : Qualification et vérification d'éligibilité (agent)
    { to: "En cours d'analyse", roles: AGENT_ROLES },
  ],
  "En cours d'analyse": [
    // Étape 3 : Validation / approbation si requise -> transmis au manager
    { to: 'En attente de validation', roles: AGENT_ROLES },
    // Cas simple ne nécessitant pas de validation : passage direct en réalisation
    { to: 'En cours de réalisation', roles: AGENT_ROLES },
    // Information complémentaire requise auprès du client
    { to: 'En attente client', roles: AGENT_ROLES },
    // Demande non éligible
    { to: 'Rejetée', roles: AGENT_ROLES },
  ],
  'En attente de validation': [
    { to: 'En cours de réalisation', roles: MANAGER_ROLES },
    { to: 'Rejetée', roles: MANAGER_ROLES },
  ],
  'En cours de réalisation': [
    // Étape 4 : Réalisation de la demande (agent)
    { to: 'Réalisée', roles: AGENT_ROLES },
    { to: 'En attente client', roles: AGENT_ROLES },
  ],
  'En attente client': [
    // Le client fournit l'information demandée -> reprise de l'analyse
    { to: "En cours d'analyse", roles: ['CLIENT', ...AGENT_ROLES] },
    // Clôture automatique après 2 jours ouvrés sans réponse
    { to: 'Clôturée', roles: AGENT_ROLES },
  ],
  Rejetée: [], // état final, motivé
  Réalisée: [
    // Étape 5 : Confirmation et clôture (Client / agent)
    { to: 'Clôturée', roles: ['CLIENT', ...AGENT_ROLES] },
  ],
  Clôturée: [], // état final
  Annulé: [], // état final : exclu du workflow, aucune action possible
};

// ---------------------------------------------------------------------
// CHANGEMENT — §2.3.4 (Statuts) + §2.3.5 (Workflow de traitement)
// ---------------------------------------------------------------------
const CHANGEMENT_STATUTS = [
  'Soumis',
  'En attente de validation',
  'Approuvé',
  'Planifié',
  "En cours d'implémentation",
  'Rollback',
  'Implémenté',
  'En revue post-implémentation',
  'Rejeté',
  'Clôturé',
  'Annulé',
];

/**
 * Statuts depuis lesquels le client propriétaire peut ANNULER son changement
 * (avant le début de l'implémentation).
 */
const CHANGEMENT_STATUTS_ANNULABLES = [
  'Soumis',
  'En attente de validation',
  'Approuvé',
  'Planifié',
];

const CHANGEMENT_TRANSITIONS = {
  Soumis: [
    // Étape 2 : Évaluation du risque et de l'impact (manager)
    { to: 'En attente de validation', roles: MANAGER_ROLES },
  ],
  'En attente de validation': [
    // Étape 3 : Validation selon le type de changement (manager)
    { to: 'Approuvé', roles: MANAGER_ROLES },
    { to: 'Rejeté', roles: MANAGER_ROLES },
  ],
  Approuvé: [
    // Étape 4 : Planification de la fenêtre d'intervention (agent)
    { to: 'Planifié', roles: AGENT_ROLES },
  ],
  Planifié: [
    // Étape 5 : Sauvegarde et exécution du changement (agent)
    { to: "En cours d'implémentation", roles: AGENT_ROLES },
  ],
  "En cours d'implémentation": [
    // Étape 6 : Test et vérification post-changement (agent)
    { to: 'Implémenté', roles: AGENT_ROLES },
    { to: 'Rollback', roles: AGENT_ROLES },
  ],
  Rollback: [{ to: 'Clôturé', roles: AGENT_ROLES }], // clôturé "échec"
  Implémenté: [
    // Étape 7 : Revue post-implémentation et clôture (manager)
    { to: 'En revue post-implémentation', roles: MANAGER_ROLES },
  ],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: MANAGER_ROLES }],
  Rejeté: [], // état final, motivé
  Clôturé: [], // état final
  Annulé: [], // état final : exclu du workflow, aucune action possible
};

// ---------------------------------------------------------------------
// TICKET / INCIDENT — Incident Management
// ---------------------------------------------------------------------
const TICKET_TYPES = ['Incident'];

const TICKET_STATUTS = [
  'Nouveau',
  'Affecté',
  "En cours d'analyse",
  'En attente client',
  'En attente tiers',
  'En cours de résolution',
  'Résolu',
  'Clôturé',
  'Réouvert',
];

/** Statuts qui suspendent le SLA. */
const TICKET_STATUTS_SLA_PAUSE = ['En attente client', 'En attente tiers'];

const TICKET_TRANSITIONS = {
  Nouveau: [
    { to: 'Affecté', roles: AGENT_ROLES.concat(MANAGER_ROLES) },
    { to: "En cours d'analyse", roles: AGENT_ROLES.concat(MANAGER_ROLES) },
  ],
  Affecté: [{ to: "En cours d'analyse", roles: AGENT_ROLES.concat(MANAGER_ROLES) }],
  "En cours d'analyse": [
    { to: 'En cours de résolution', roles: AGENT_ROLES.concat(MANAGER_ROLES) },
    { to: 'En attente client', roles: AGENT_ROLES.concat(MANAGER_ROLES) },
    { to: 'En attente tiers', roles: AGENT_ROLES.concat(MANAGER_ROLES) },
  ],
  'En attente client': [
    { to: "En cours d'analyse", roles: ['CLIENT', ...AGENT_ROLES, ...MANAGER_ROLES] },
  ],
  'En attente tiers': [{ to: 'En cours de résolution', roles: AGENT_ROLES.concat(MANAGER_ROLES) }],
  'En cours de résolution': [{ to: 'Résolu', roles: AGENT_ROLES.concat(MANAGER_ROLES) }],
  Résolu: [
    { to: 'Clôturé', roles: ['CLIENT', ...AGENT_ROLES, ...MANAGER_ROLES] },
    { to: 'Réouvert', roles: ['CLIENT', ...AGENT_ROLES, ...MANAGER_ROLES] },
  ],
  Clôturé: [],
  Réouvert: [{ to: "En cours d'analyse", roles: AGENT_ROLES.concat(MANAGER_ROLES) }],
};

/**
 * Vérifie si la transition `from` -> `to` est autorisée pour `role`.
 * ADMIN passe toujours (supervision / correction manuelle), MAIS uniquement
 * vers une cible effectivement définie, et JAMAIS depuis un état figé
 * (« Annulé », « Clôturé » / « Clôturée »).
 */
function canTransition(transitions, from, to, role) {
  if (from === 'Annulé' || from === 'Clôturé' || from === 'Clôturée') return false;
  const options = transitions[from] || [];
  if (role === 'ADMIN') {
    return options.some((o) => o.to === to);
  }
  const match = options.find((o) => o.to === to);
  return !!match && match.roles.includes(role);
}

/**
 * Liste les statuts cibles atteignables depuis `from` pour `role`
 * (utilisé par le frontend pour proposer les actions disponibles).
 */
function availableTransitions(transitions, from, role) {
  if (from === 'Annulé') return [];
  const options = transitions[from] || [];
  if (role === 'ADMIN') return options.map((o) => o.to);
  return options.filter((o) => o.roles.includes(role)).map((o) => o.to);
}

module.exports = {
  AGENT_ROLES,
  MANAGER_ROLES,
  DEMANDE_STATUTS,
  DEMANDE_STATUTS_ANNULABLES,
  DEMANDE_TRANSITIONS,
  CHANGEMENT_STATUTS,
  CHANGEMENT_STATUTS_ANNULABLES,
  CHANGEMENT_TRANSITIONS,
  TICKET_TYPES,
  TICKET_STATUTS,
  TICKET_STATUTS_SLA_PAUSE,
  TICKET_TRANSITIONS,
  canTransition,
  availableTransitions,
};

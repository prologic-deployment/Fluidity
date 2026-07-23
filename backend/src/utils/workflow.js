/**
 * Moteur de workflow (cycle de vie des statuts) pour les Demandes et les
 * Changements — rôles entreprise multi-tenant :
 *   AGENT  : traitement opérationnel (ex-Support N1 / Exploitation)
 *   MANAGER: validation et pilotage (ex-Responsable Technique / Commercial)
 *   CLIENT : action du demandeur (réponse, clôture, annulation)
 *
 * Chaque statut liste les transitions sortantes autorisées, et pour
 * chacune, les rôles habilités. PLATFORM_ADMIN et TENANT_ADMIN peuvent
 * toujours forcer une transition (supervision), SAUF depuis « Annulé ».
 */

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
const DEMANDE_STATUTS_ANNULABLES = ['Ouverte', "En cours d'analyse", 'En attente de validation', 'En attente client'];

const DEMANDE_TRANSITIONS = {
  Ouverte: [
    // Étape 2 : Qualification et vérification d'éligibilité (Support N1)
    { to: "En cours d'analyse", roles: ['AGENT'] },
  ],
  "En cours d'analyse": [
    // Étape 3 : Validation / approbation si requise -> transmis au Responsable Technique
    { to: 'En attente de validation', roles: ['AGENT'] },
    // Cas simple ne nécessitant pas de validation : passage direct en réalisation
    { to: "En cours de réalisation", roles: ['AGENT'] },
    // Information complémentaire requise auprès du client
    { to: 'En attente client', roles: ['AGENT'] },
    // Demande non éligible
    { to: 'Rejetée', roles: ['AGENT'] },
  ],
  'En attente de validation': [
    { to: "En cours de réalisation", roles: ['MANAGER'] },
    { to: 'Rejetée', roles: ['MANAGER'] },
  ],
  "En cours de réalisation": [
    // Étape 4 : Réalisation de la demande (Support N1/N2)
    { to: 'Réalisée', roles: ['AGENT'] },
    { to: 'En attente client', roles: ['AGENT'] },
  ],
  'En attente client': [
    // Le client fournit l'information demandée -> reprise de l'analyse
    { to: "En cours d'analyse", roles: ['CLIENT', 'AGENT'] },
    // Clôture automatique après 2 jours ouvrés sans réponse (déclenchée manuellement ici, ou par un job planifié)
    { to: 'Clôturée', roles: ['AGENT'] },
  ],
  Rejetée: [], // état final, motivé
  Réalisée: [
    // Étape 5 : Confirmation et clôture (Client / Support N1)
    { to: 'Clôturée', roles: ['CLIENT', 'AGENT'] },
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
 * (avant le début de l'implémentation). Une fois annulé, le changement reste
 * en base mais sort définitivement du workflow.
 */
const CHANGEMENT_STATUTS_ANNULABLES = ['Soumis', 'En attente de validation', 'Approuvé', 'Planifié'];

const CHANGEMENT_TRANSITIONS = {
  Soumis: [
    // Étape 2 : Évaluation du risque et de l'impact (Responsable Technique)
    { to: 'En attente de validation', roles: ['MANAGER'] },
  ],
  'En attente de validation': [
    // Étape 3 : Validation selon le type de changement (Responsable Technique / Commercial)
    { to: 'Approuvé', roles: ['MANAGER'] },
    { to: 'Rejeté', roles: ['MANAGER'] },
  ],
  Approuvé: [
    // Étape 4 : Planification de la fenêtre d'intervention (Exploitation)
    { to: 'Planifié', roles: ['AGENT'] },
  ],
  Planifié: [
    // Étape 5 : Sauvegarde et exécution du changement (Exploitation)
    { to: "En cours d'implémentation", roles: ['AGENT'] },
  ],
  "En cours d'implémentation": [
    // Étape 6 : Test et vérification post-changement (Exploitation)
    { to: 'Implémenté', roles: ['AGENT'] },
    { to: 'Rollback', roles: ['AGENT'] },
  ],
  Rollback: [{ to: 'Clôturé', roles: ['AGENT'] }], // clôturé "échec"
  Implémenté: [
    // Étape 7 : Revue post-implémentation et clôture (Responsable Technique)
    { to: 'En revue post-implémentation', roles: ['MANAGER'] },
  ],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: ['MANAGER'] }],
  Rejeté: [], // état final, motivé
  Clôturé: [], // état final
  Annulé: [], // état final : exclu du workflow, aucune action possible
};

/**
 * Vérifie si la transition `from` -> `to` est autorisée pour `role`.
 * ADMIN passe toujours (supervision / correction manuelle), SAUF depuis
 * « Annulé » : un dossier annulé est figé pour tout le monde.
 */
function canTransition(transitions, from, to, role) {
  if (from === 'Annulé') return false;
  if (role === 'PLATFORM_ADMIN' || role === 'TENANT_ADMIN') return true;
  const options = transitions[from] || [];
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
  if (role === 'PLATFORM_ADMIN' || role === 'TENANT_ADMIN') return options.map((o) => o.to);
  return options.filter((o) => o.roles.includes(role)).map((o) => o.to);
}

module.exports = {
  DEMANDE_STATUTS,
  DEMANDE_STATUTS_ANNULABLES,
  DEMANDE_TRANSITIONS,
  CHANGEMENT_STATUTS,
  CHANGEMENT_STATUTS_ANNULABLES,
  CHANGEMENT_TRANSITIONS,
  canTransition,
  availableTransitions,
};

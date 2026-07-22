/**
 * Moteur de workflow (cycle de vie des statuts) pour les Demandes et les
 * Changements, conforme aux tableaux "Statuts et cycle de vie" /
 * "Workflow de traitement" du cahier des charges.
 *
 * Chaque statut liste les transitions sortantes autorisées, et pour
 * chacune, les rôles habilités à l'exécuter. Le rôle ADMIN peut toujours
 * forcer n'importe quelle transition (supervision).
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
    { to: "En cours d'analyse", roles: ['SUPPORT_N1'] },
  ],
  "En cours d'analyse": [
    // Étape 3 : Validation / approbation si requise -> transmis au Responsable Technique
    { to: 'En attente de validation', roles: ['SUPPORT_N1'] },
    // Cas simple ne nécessitant pas de validation : passage direct en réalisation
    { to: "En cours de réalisation", roles: ['SUPPORT_N1'] },
    // Information complémentaire requise auprès du client
    { to: 'En attente client', roles: ['SUPPORT_N1'] },
    // Demande non éligible
    { to: 'Rejetée', roles: ['SUPPORT_N1'] },
  ],
  'En attente de validation': [
    { to: "En cours de réalisation", roles: ['RESPONSABLE_TECHNIQUE'] },
    { to: 'Rejetée', roles: ['RESPONSABLE_TECHNIQUE'] },
  ],
  "En cours de réalisation": [
    // Étape 4 : Réalisation de la demande (Support N1/N2)
    { to: 'Réalisée', roles: ['SUPPORT_N1'] },
    { to: 'En attente client', roles: ['SUPPORT_N1'] },
  ],
  'En attente client': [
    // Le client fournit l'information demandée -> reprise de l'analyse
    { to: "En cours d'analyse", roles: ['CLIENT', 'SUPPORT_N1'] },
    // Clôture automatique après 2 jours ouvrés sans réponse (déclenchée manuellement ici, ou par un job planifié)
    { to: 'Clôturée', roles: ['SUPPORT_N1'] },
  ],
  Rejetée: [], // état final, motivé
  Réalisée: [
    // Étape 5 : Confirmation et clôture (Client / Support N1)
    { to: 'Clôturée', roles: ['CLIENT', 'SUPPORT_N1'] },
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
    { to: 'En attente de validation', roles: ['RESPONSABLE_TECHNIQUE'] },
  ],
  'En attente de validation': [
    // Étape 3 : Validation selon le type de changement (Responsable Technique / Commercial)
    { to: 'Approuvé', roles: ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'] },
    { to: 'Rejeté', roles: ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'] },
  ],
  Approuvé: [
    // Étape 4 : Planification de la fenêtre d'intervention (Exploitation)
    { to: 'Planifié', roles: ['EXPLOITATION'] },
  ],
  Planifié: [
    // Étape 5 : Sauvegarde et exécution du changement (Exploitation)
    { to: "En cours d'implémentation", roles: ['EXPLOITATION'] },
  ],
  "En cours d'implémentation": [
    // Étape 6 : Test et vérification post-changement (Exploitation)
    { to: 'Implémenté', roles: ['EXPLOITATION'] },
    { to: 'Rollback', roles: ['EXPLOITATION'] },
  ],
  Rollback: [{ to: 'Clôturé', roles: ['EXPLOITATION'] }], // clôturé "échec"
  Implémenté: [
    // Étape 7 : Revue post-implémentation et clôture (Responsable Technique)
    { to: 'En revue post-implémentation', roles: ['RESPONSABLE_TECHNIQUE'] },
  ],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: ['RESPONSABLE_TECHNIQUE'] }],
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
  if (role === 'ADMIN') return true;
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
  if (role === 'ADMIN') return options.map((o) => o.to);
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

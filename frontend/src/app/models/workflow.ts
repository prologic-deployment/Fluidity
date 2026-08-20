/**
 * Miroir client du moteur de workflow backend (voir backend/src/utils/workflow.js).
 * Sert uniquement à afficher les actions disponibles dans l'UI ; la
 * validation faisant foi reste toujours côté serveur.
 *
 * Groupes de rôles (application mono-organisation) :
 *   AGENT   = SUPPORT_N1, EXPLOITATION
 *   MANAGER = RESPONSABLE_TECHNIQUE, COMMERCIAL
 */

export interface Transition {
  to: string;
  roles: string[];
}

const AGENT = ['SUPPORT_N1', 'EXPLOITATION'];
const MANAGER = ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'];

export const DEMANDE_TRANSITIONS: Record<string, Transition[]> = {
  Ouverte: [{ to: "En cours d'analyse", roles: AGENT }],
  "En cours d'analyse": [
    { to: 'En attente de validation', roles: AGENT },
    { to: 'En cours de réalisation', roles: AGENT },
    { to: 'En attente client', roles: AGENT },
    { to: 'Rejetée', roles: AGENT },
  ],
  'En attente de validation': [
    { to: 'En cours de réalisation', roles: MANAGER },
    { to: 'Rejetée', roles: MANAGER },
  ],
  'En cours de réalisation': [
    { to: 'Réalisée', roles: AGENT },
    { to: 'En attente client', roles: AGENT },
  ],
  'En attente client': [
    { to: "En cours d'analyse", roles: ['CLIENT', ...AGENT] },
    { to: 'Clôturée', roles: AGENT },
  ],
  Rejetée: [],
  Réalisée: [{ to: 'Clôturée', roles: ['CLIENT', ...AGENT] }],
  Clôturée: [],
  Annulé: [],
};

export const CHANGEMENT_TRANSITIONS: Record<string, Transition[]> = {
  Soumis: [{ to: 'En attente de validation', roles: MANAGER }],
  'En attente de validation': [
    { to: 'Approuvé', roles: MANAGER },
    { to: 'Rejeté', roles: MANAGER },
  ],
  Approuvé: [{ to: 'Planifié', roles: AGENT }],
  Planifié: [{ to: "En cours d'implémentation", roles: AGENT }],
  "En cours d'implémentation": [
    { to: 'Implémenté', roles: AGENT },
    { to: 'Rollback', roles: AGENT },
  ],
  Rollback: [{ to: 'Clôturé', roles: AGENT }],
  Implémenté: [{ to: 'En revue post-implémentation', roles: MANAGER }],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: MANAGER }],
  Rejeté: [],
  Clôturé: [],
  Annulé: [],
};

export const TICKET_TRANSITIONS: Record<string, Transition[]> = {
  Nouveau: [
    { to: 'Affecté', roles: [...AGENT, ...MANAGER] },
    { to: "En cours d'analyse", roles: [...AGENT, ...MANAGER] },
  ],
  Affecté: [{ to: "En cours d'analyse", roles: [...AGENT, ...MANAGER] }],
  "En cours d'analyse": [
    { to: 'En cours de résolution', roles: [...AGENT, ...MANAGER] },
    { to: 'En attente client', roles: [...AGENT, ...MANAGER] },
    { to: 'En attente tiers', roles: [...AGENT, ...MANAGER] },
  ],
  'En attente client': [{ to: "En cours d'analyse", roles: ['CLIENT', ...AGENT, ...MANAGER] }],
  'En attente tiers': [{ to: 'En cours de résolution', roles: [...AGENT, ...MANAGER] }],
  'En cours de résolution': [{ to: 'Résolu', roles: [...AGENT, ...MANAGER] }],
  Résolu: [
    { to: 'Clôturé', roles: ['CLIENT', ...AGENT, ...MANAGER] },
    { to: 'Réouvert', roles: ['CLIENT', ...AGENT, ...MANAGER] },
  ],
  Clôturé: [],
  Réouvert: [{ to: "En cours d'analyse", roles: [...AGENT, ...MANAGER] }],
};

/**
 * Statuts cibles atteignables depuis `from` pour `role`.
 * ADMIN : toute transition définie (sauf depuis un état figé).
 */
export function availableTransitions(
  transitions: Record<string, Transition[]>,
  from: string | undefined,
  role: string | null | undefined
): string[] {
  if (!from || !role || from === 'Annulé') return [];
  const options = transitions[from] || [];
  if (role === 'ADMIN') return options.map((o) => o.to);
  return options.filter((o) => o.roles.includes(role)).map((o) => o.to);
}

// ---------------------------------------------------------------------
// Ordre des statuts pour l'indicateur de workflow (stepper).
// Chemin principal linéaire + branches (états terminaux / d'attente).
// ---------------------------------------------------------------------

/** Chemin principal du cycle de vie d'une Demande. */
export const DEMANDE_STATUTS_ORDER: string[] = [
  'Ouverte',
  "En cours d'analyse",
  'En attente de validation',
  'En cours de réalisation',
  'Réalisée',
  'Clôturée',
];

/** Branches d'une Demande (attente client, rejet, annulation). */
export const DEMANDE_STATUTS_BRANCHES: string[] = ['En attente client', 'Rejetée', 'Annulé'];

/** Chemin principal du cycle de vie d'un Changement. */
export const CHANGEMENT_STATUTS_ORDER: string[] = [
  'Soumis',
  'En attente de validation',
  'Approuvé',
  'Planifié',
  "En cours d'implémentation",
  'Implémenté',
  'En revue post-implémentation',
  'Clôturé',
];

/** Branches d'un Changement (rollback, rejet, annulation). */
export const CHANGEMENT_STATUTS_BRANCHES: string[] = ['Rollback', 'Rejeté', 'Annulé'];

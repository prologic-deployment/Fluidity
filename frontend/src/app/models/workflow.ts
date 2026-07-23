/**
 * Miroir client du moteur de workflow backend (voir backend/src/utils/workflow.js).
 * Sert uniquement à afficher les actions disponibles dans l'UI ; la
 * validation faisant foi reste toujours côté serveur.
 *
 * Rôles entreprise multi-tenant :
 *   AGENT   : traitement opérationnel (ex-Support N1 / Exploitation)
 *   MANAGER : validation et pilotage (ex-Responsable Technique / Commercial)
 *   CLIENT  : action du demandeur (réponse, clôture, annulation)
 */

export interface Transition {
  to: string;
  roles: string[];
}

export const DEMANDE_TRANSITIONS: Record<string, Transition[]> = {
  Ouverte: [{ to: "En cours d'analyse", roles: ['AGENT'] }],
  "En cours d'analyse": [
    { to: 'En attente de validation', roles: ['AGENT'] },
    { to: 'En cours de réalisation', roles: ['AGENT'] },
    { to: 'En attente client', roles: ['AGENT'] },
    { to: 'Rejetée', roles: ['AGENT'] },
  ],
  'En attente de validation': [
    { to: 'En cours de réalisation', roles: ['MANAGER'] },
    { to: 'Rejetée', roles: ['MANAGER'] },
  ],
  'En cours de réalisation': [
    { to: 'Réalisée', roles: ['AGENT'] },
    { to: 'En attente client', roles: ['AGENT'] },
  ],
  'En attente client': [
    { to: "En cours d'analyse", roles: ['CLIENT', 'AGENT'] },
    { to: 'Clôturée', roles: ['AGENT'] },
  ],
  Rejetée: [],
  Réalisée: [{ to: 'Clôturée', roles: ['CLIENT', 'AGENT'] }],
  Clôturée: [],
  Annulé: [], // état final : exclu du workflow, aucune action possible
};

export const CHANGEMENT_TRANSITIONS: Record<string, Transition[]> = {
  Soumis: [{ to: 'En attente de validation', roles: ['MANAGER'] }],
  'En attente de validation': [
    { to: 'Approuvé', roles: ['MANAGER'] },
    { to: 'Rejeté', roles: ['MANAGER'] },
  ],
  Approuvé: [{ to: 'Planifié', roles: ['AGENT'] }],
  Planifié: [{ to: "En cours d'implémentation", roles: ['AGENT'] }],
  "En cours d'implémentation": [
    { to: 'Implémenté', roles: ['AGENT'] },
    { to: 'Rollback', roles: ['AGENT'] },
  ],
  Rollback: [{ to: 'Clôturé', roles: ['AGENT'] }],
  Implémenté: [{ to: 'En revue post-implémentation', roles: ['MANAGER'] }],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: ['MANAGER'] }],
  Rejeté: [],
  Clôturé: [],
  Annulé: [], // état final : exclu du workflow, aucune action possible
};

/** Rôles de supervision : toute transition est autorisée, SAUF depuis « Annulé ». */
const ROLES_FORCE = ['PLATFORM_ADMIN', 'TENANT_ADMIN'];

/** Statuts cibles atteignables depuis `from` pour `role` (supervision : tout autorisé, sauf depuis « Annulé »). */
export function availableTransitions(
  transitions: Record<string, Transition[]>,
  from: string | undefined,
  role: string | null | undefined
): string[] {
  if (!from || !role || from === 'Annulé') return [];
  const options = transitions[from] || [];
  if (ROLES_FORCE.includes(role)) return options.map((o) => o.to);
  return options.filter((o) => o.roles.includes(role)).map((o) => o.to);
}

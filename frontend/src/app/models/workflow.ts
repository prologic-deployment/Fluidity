/**
 * Miroir client du moteur de workflow backend (voir backend/src/utils/workflow.js).
 * Sert uniquement à afficher les actions disponibles dans l'UI ; la
 * validation faisant foi reste toujours côté serveur.
 */

export interface Transition {
  to: string;
  roles: string[];
}

export const DEMANDE_TRANSITIONS: Record<string, Transition[]> = {
  Ouverte: [{ to: "En cours d'analyse", roles: ['SUPPORT_N1'] }],
  "En cours d'analyse": [
    { to: 'En attente de validation', roles: ['SUPPORT_N1'] },
    { to: 'En cours de réalisation', roles: ['SUPPORT_N1'] },
    { to: 'En attente client', roles: ['SUPPORT_N1'] },
    { to: 'Rejetée', roles: ['SUPPORT_N1'] },
  ],
  'En attente de validation': [
    { to: 'En cours de réalisation', roles: ['RESPONSABLE_TECHNIQUE'] },
    { to: 'Rejetée', roles: ['RESPONSABLE_TECHNIQUE'] },
  ],
  'En cours de réalisation': [
    { to: 'Réalisée', roles: ['SUPPORT_N1'] },
    { to: 'En attente client', roles: ['SUPPORT_N1'] },
  ],
  'En attente client': [
    { to: "En cours d'analyse", roles: ['CLIENT', 'SUPPORT_N1'] },
    { to: 'Clôturée', roles: ['SUPPORT_N1'] },
  ],
  Rejetée: [],
  Réalisée: [{ to: 'Clôturée', roles: ['CLIENT', 'SUPPORT_N1'] }],
  Clôturée: [],
};

export const CHANGEMENT_TRANSITIONS: Record<string, Transition[]> = {
  Soumis: [{ to: 'En attente de validation', roles: ['RESPONSABLE_TECHNIQUE'] }],
  'En attente de validation': [
    { to: 'Approuvé', roles: ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'] },
    { to: 'Rejeté', roles: ['RESPONSABLE_TECHNIQUE', 'COMMERCIAL'] },
  ],
  Approuvé: [{ to: 'Planifié', roles: ['EXPLOITATION'] }],
  Planifié: [{ to: "En cours d'implémentation", roles: ['EXPLOITATION'] }],
  "En cours d'implémentation": [
    { to: 'Implémenté', roles: ['EXPLOITATION'] },
    { to: 'Rollback', roles: ['EXPLOITATION'] },
  ],
  Rollback: [{ to: 'Clôturé', roles: ['EXPLOITATION'] }],
  Implémenté: [{ to: 'En revue post-implémentation', roles: ['RESPONSABLE_TECHNIQUE'] }],
  'En revue post-implémentation': [{ to: 'Clôturé', roles: ['RESPONSABLE_TECHNIQUE'] }],
  Rejeté: [],
  Clôturé: [],
};

/** Statuts cibles atteignables depuis `from` pour `role` (ADMIN : tout autorisé). */
export function availableTransitions(
  transitions: Record<string, Transition[]>,
  from: string | undefined,
  role: string | null | undefined
): string[] {
  if (!from || !role) return [];
  const options = transitions[from] || [];
  if (role === 'ADMIN') return options.map((o) => o.to);
  return options.filter((o) => o.roles.includes(role)).map((o) => o.to);
}

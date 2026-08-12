/**
 * Matrice Impact × Urgence → Priorité (P1–P4).
 * Source unique backend — le frontend doit rester aligné
 * (frontend/src/app/models/ticket.model.ts).
 *
 *              Faible   Moyenne   Élevée   Critique
 * Faible          P4       P4        P3        P3
 * Moyen           P4       P3        P3        P2
 * Élevé           P3       P3        P2        P1
 * Critique        P3       P2        P1        P1
 */

const IMPACTS = Object.freeze(['Faible', 'Moyen', 'Élevé', 'Critique']);
const URGENCES = Object.freeze(['Faible', 'Moyenne', 'Élevée', 'Critique']);
const PRIORITES = Object.freeze(['P1', 'P2', 'P3', 'P4']);

const MATRIX = Object.freeze({
  Faible: { Faible: 'P4', Moyenne: 'P4', Élevée: 'P3', Critique: 'P3' },
  Moyen: { Faible: 'P4', Moyenne: 'P3', Élevée: 'P3', Critique: 'P2' },
  Élevé: { Faible: 'P3', Moyenne: 'P3', Élevée: 'P2', Critique: 'P1' },
  Critique: { Faible: 'P3', Moyenne: 'P2', Élevée: 'P1', Critique: 'P1' },
});

/** Cibles SLA par défaut (heures calendaires) — le contrat n'en définit pas encore. */
const SLA_DEFAUT_HEURES = Object.freeze({
  P1: { reponse: 1, resolution: 4 },
  P2: { reponse: 4, resolution: 8 },
  P3: { reponse: 8, resolution: 24 },
  P4: { reponse: 24, resolution: 72 },
});

function calculatePriority(impact, urgency) {
  const row = MATRIX[impact];
  if (!row) {
    throw new Error(`Impact invalide : ${impact}`);
  }
  const priorite = row[urgency];
  if (!priorite) {
    throw new Error(`Urgence invalide : ${urgency}`);
  }
  return priorite;
}

function slaDefautPour(priorite) {
  return SLA_DEFAUT_HEURES[priorite] || SLA_DEFAUT_HEURES.P4;
}

module.exports = {
  IMPACTS,
  URGENCES,
  PRIORITES,
  MATRIX,
  SLA_DEFAUT_HEURES,
  calculatePriority,
  slaDefautPour,
};

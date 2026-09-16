/**
 * Capacité des membres (Fix 21) — logique pure (sans base) : capacité
 * d'un membre sur une période (taux hebdo au prorata moins les absences
 * chevauchantes, 5 jours ouvrés/semaine) et détection des dépassements.
 */

const DAY = 86400000;

/**
 * Capacité disponible (heures) d'un membre sur [startDate, endDate].
 * Sans dates : repli sur `fallbackWeeks` semaines pleines.
 */
const memberCapacity = (member, startDate, endDate, fallbackWeeks = 2) => {
  const weekly = Math.max(0, Number(member?.weeklyCapacityHours) || 0);
  if (!weekly) return 0;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const dated = start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
  const weeks = dated ? (end.getTime() - start.getTime()) / (7 * DAY) : fallbackWeeks;
  const dailyRate = weekly / 5;
  let absenceDays = 0;
  if (dated) {
    for (const a of member?.absences || []) {
      const aStart = a?.startDate ? new Date(a.startDate) : null;
      const aEnd = a?.endDate ? new Date(a.endDate) : null;
      if (!aStart || !aEnd || Number.isNaN(aStart.getTime()) || Number.isNaN(aEnd.getTime()) || aEnd < aStart) continue;
      const overlapStart = Math.max(start.getTime(), aStart.getTime());
      const overlapEnd = Math.min(end.getTime(), aEnd.getTime());
      if (overlapEnd >= overlapStart) {
        absenceDays += Math.floor((overlapEnd - overlapStart) / DAY) + 1;
      }
    }
  }
  return Math.max(0, Math.round((weekly * weeks - absenceDays * dailyRate) * 10) / 10);
};

/**
 * Dépassements de capacité : committedByUser = { userId: heures engagées },
 * members = [{ userId, weeklyCapacityHours, absences, name? }].
 * Retourne [{ userId, name, committed, capacity }] pour les dépassements.
 */
const capacityWarnings = (committedByUser, members, startDate, endDate, fallbackWeeks) => {
  const warnings = [];
  for (const m of members || []) {
    const uid = String(m.userId && m.userId._id ? m.userId._id : m.userId);
    const committed = Math.round((Number((committedByUser || {})[uid]) || 0) * 10) / 10;
    if (!committed) continue;
    const capacity = memberCapacity(m, startDate, endDate, fallbackWeeks);
    if (committed > capacity) {
      warnings.push({ userId: uid, name: m.name || '', committed, capacity });
    }
  }
  return warnings;
};

module.exports = { memberCapacity, capacityWarnings };

/**
 * Budget vs réel (Fix 17) — logique pure (sans base) : le coût réel est
 * la somme des saisies de temps valorisées au taux horaire du membre.
 * Le contrôleur persiste/agrège ; ce module est testé sans dépendance.
 *
 * @param {Array<{userId: string, minutes: number}>} entries saisies de temps
 * @param {Record<string, number>} rates taux horaire par userId (0 = non valorisé)
 * @returns {{ totalMinutes: number, actualCost: number, byUser: Record<string, {minutes: number, cost: number}> }}
 */
const computeBudgetActuals = (entries, rates) => {
  const byUser = {};
  let totalMinutes = 0;
  let actualCost = 0;
  for (const e of entries || []) {
    const minutes = Math.max(0, Number(e.minutes) || 0);
    if (!minutes) continue;
    const uid = String(e.userId);
    const rate = Math.max(0, Number((rates || {})[uid]) || 0);
    const cost = (minutes / 60) * rate;
    totalMinutes += minutes;
    actualCost += cost;
    const acc = byUser[uid] || { minutes: 0, cost: 0 };
    acc.minutes += minutes;
    acc.cost += cost;
    byUser[uid] = acc;
  }
  // Arrondi centimes (évite 19.9999999).
  actualCost = Math.round(actualCost * 100) / 100;
  for (const uid of Object.keys(byUser)) {
    byUser[uid].cost = Math.round(byUser[uid].cost * 100) / 100;
  }
  return { totalMinutes, actualCost, byUser };
};

module.exports = { computeBudgetActuals };

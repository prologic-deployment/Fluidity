/**
 * Burndown / burnup de sprint (Fix 20) — logique pure (sans base) : cumul
 * des complétions par jour comparé à la ligne idéale (linéaire). Unité
 * `points` par défaut, avec repli sur les heures estimées quand aucun
 * story point n'est renseigné.
 *
 * @param {Array<{status: string, points: number, estimatedHours: number, completedAt: unknown}>} tasks
 * @param {unknown} startDate
 * @param {unknown} endDate
 * @param {'points'|'hours'} unit
 * @param {string[]} doneStatuses — états « done » du workflow (Fix 25, défaut ['completed'])
 * @returns {{ unit: string, total: number, burndown: Array<{day:number,remaining:number,ideal:number}>, burnup: Array<{day:number,completed:number,total:number}> }}
 */
const computeBurndown = (tasks, startDate, endDate, unit, doneStatuses = ['completed']) => {
  const done = new Set(doneStatuses && doneStatuses.length ? doneStatuses : ['completed']);
  const valueOf = (t) => (unit === 'hours' ? Number(t.estimatedHours) || 0 : Number(t.points) || 0);
  const total = (tasks || []).reduce((a, t) => a + valueOf(t), 0);
  const empty = { unit, total, burndown: [], burnup: [] };
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || total <= 0) {
    return empty;
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const burndown = [];
  const burnup = [];
  let completedSoFar = 0;
  for (let d = 0; d <= days; d += 1) {
    const dayStart = new Date(start.getTime() + d * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    completedSoFar += (tasks || [])
      .filter((t) => done.has(t.status) && t.completedAt && new Date(t.completedAt) >= dayStart && new Date(t.completedAt) < dayEnd)
      .reduce((a, t) => a + valueOf(t), 0);
    const ideal = Math.round(total * (1 - d / days) * 10) / 10;
    const remaining = Math.round(Math.max(0, total - completedSoFar) * 10) / 10;
    burndown.push({ day: d, remaining, ideal });
    burnup.push({ day: d, completed: Math.round(completedSoFar * 10) / 10, total });
  }
  return { unit, total, burndown, burnup };
};

module.exports = { computeBurndown };

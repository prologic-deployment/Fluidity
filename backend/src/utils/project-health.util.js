/**
 * Moteur de SANTÉ PROJET — calcul configurable, jamais de statut codé en dur.
 *
 * Facteurs (pondérations réglables par projet via Project.healthRules) :
 *   - tâches en retard (overdue) ;
 *   - tâches bloquées ;
 *   - jalons/phases en retard (au-delà d'un seuil de jours) ;
 *   - proximité de l'échéance du projet ;
 *   - écart entre progression réelle et progression attendue (linéaire).
 *
 * Chaque raison retournée est une CLÉ i18n + params (affichable FR/EN).
 */

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

/**
 * Calcule la santé d'un projet.
 * @param project document projet (avec healthRules)
 * @param stats { overdueTasks, blockedTasks, delayedMilestones: [{name, daysLate}],
 *                totalTasks, completedTasks }
 * @returns { status: 'on_track'|'at_risk'|'off_track', score, reasons: [{key, params}] }
 *
 * Un forçage manuel (Project.healthOverride) par le chef de projet — avec
 * justification — prévaut sur le calcul automatique.
 */
function computeProjectHealth(project, stats) {
  // Forçage manuel du chef de projet (avec justification) : prévaut.
  if (project.healthOverride?.status) {
    return {
      status: project.healthOverride.status,
      score: null,
      reasons: [{ key: 'projects.health.reasonOverride', params: { reason: project.healthOverride.reason || '' } }],
      overridden: true,
    };
  }
  const rules = project.healthRules || {};
  const overdueWeight = rules.overdueWeight ?? 3;
  const milestoneDelayDays = rules.milestoneDelayDays ?? 3;
  const deadlineProximityDays = rules.deadlineProximityDays ?? 14;
  const progressGapTolerance = rules.progressGapTolerance ?? 15;

  const reasons = [];
  let score = 0;

  const overdue = stats.overdueTasks || 0;
  if (overdue > 0) {
    score += overdue * overdueWeight;
    reasons.push({ key: 'projects.health.reasonOverdue', params: { n: overdue } });
  }

  const blocked = stats.blockedTasks || 0;
  if (blocked > 0) {
    score += blocked;
    reasons.push({ key: 'projects.health.reasonBlocked', params: { n: blocked } });
  }

  for (const m of stats.delayedMilestones || []) {
    if (m.daysLate >= milestoneDelayDays) {
      score += 2;
      reasons.push({ key: 'projects.health.reasonMilestoneDelay', params: { name: m.name, days: m.daysLate } });
    }
  }

  // Proximité d'échéance du projet
  if (project.endDate && project.status !== 'completed') {
    const now = new Date();
    const daysLeft = daysBetween(new Date(project.endDate), now);
    if (daysLeft >= 0 && daysLeft <= deadlineProximityDays) {
      const done = stats.progress ?? 0;
      if (done < 100) {
        score += 1;
        reasons.push({ key: 'projects.health.reasonDeadlineNear', params: { days: Math.max(daysLeft, 0) } });
      }
    } else if (daysLeft < 0 && (stats.progress ?? 0) < 100) {
      score += 3;
      reasons.push({ key: 'projects.health.reasonProjectOverdue', params: { days: Math.abs(daysLeft) } });
    }
  }

  // Écart progression réelle vs attendue (linéaire entre début et fin)
  if (project.startDate && project.endDate) {
    const now = new Date();
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const total = daysBetween(end, start);
    if (total > 0) {
      const elapsed = Math.min(Math.max(daysBetween(now, start), 0), total);
      const expected = Math.round((elapsed / total) * 100);
      const actual = stats.progress ?? 0;
      if (actual + progressGapTolerance < expected) {
        score += 2;
        reasons.push({ key: 'projects.health.reasonProgressGap', params: { expected, actual } });
      }
    }
  }

  const status = score >= 5 ? 'off_track' : score >= 2 ? 'at_risk' : 'on_track';
  return { status, score, reasons, overridden: false };
}

module.exports = { computeProjectHealth };

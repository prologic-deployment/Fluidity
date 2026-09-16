/**
 * Workflow LIVRABLE — règles de transition pures (sans base de données).
 *
 *   draft --> submitted --> approved
 *                ^              |
 *                |              v
 *                +-------- rejected
 *
 * Une re-soumission (rejected → submitted) incrémente `version` et archive
 * le motif du rejet dans `reviewHistory` (le contrôleur vide alors
 * `rejectionNote`, qui ne porte que le retour bloquant courant).
 * Chaque verdict (approbation / rejet) enregistre quelle version a été
 * jugée, par qui et quand.
 */

function fail(message) {
  return { ok: false, status: 400, message };
}

/**
 * @param deliverable livrable courant ({ status, version })
 * @param to statut cible ('submitted' | 'approved' | 'rejected')
 * @param opts { actorId, note, now }
 * @returns { ok, status?, message?, resubmit?, updates?, historyEntry? }
 */
function planDeliverableTransition(deliverable, to, opts = {}) {
  const { actorId = null, note = '', now = new Date() } = opts;
  const status = deliverable?.status;
  const version = deliverable?.version || 1;

  if (to === 'submitted') {
    if (status !== 'draft' && status !== 'rejected') {
      return fail('Seul un livrable en brouillon ou rejeté peut être soumis.');
    }
    const resubmit = status === 'rejected';
    return {
      ok: true,
      resubmit,
      updates: {
        status: 'submitted',
        submittedBy: actorId,
        submittedAt: now,
        version: resubmit ? version + 1 : version,
        // En re-soumission, le motif archivé en historique ne bloque plus.
        ...(resubmit ? { rejectionNote: '', approvedBy: null, approvedAt: null } : {}),
      },
    };
  }

  if (to === 'approved' || to === 'rejected') {
    if (status !== 'submitted') {
      return fail('Seul un livrable soumis peut être approuvé ou rejeté.');
    }
    const decisionNote = to === 'rejected' ? String(note || '').slice(0, 1000) : '';
    return {
      ok: true,
      resubmit: false,
      updates: {
        status: to,
        approvedBy: actorId,
        approvedAt: now,
        rejectionNote: decisionNote,
      },
      historyEntry: {
        version,
        decision: to,
        note: decisionNote,
        decidedBy: actorId,
        decidedAt: now,
      },
    };
  }

  return fail('Transition invalide.');
}

module.exports = { planDeliverableTransition };

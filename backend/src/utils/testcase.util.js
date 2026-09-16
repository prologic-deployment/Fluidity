/**
 * Cas de test QA (Fix 18) — logique pure (sans base) : statuts, sévérités
 * et enregistrement d'un verdict (passé/échoué/bloqué) avec historique
 * des exécutions (cycle de re-test). Testé sans dépendance.
 */

const TESTCASE_STATUSES = ['draft', 'ready', 'passed', 'failed', 'blocked'];
const TESTCASE_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const TESTCASE_RESULTS = ['passed', 'failed', 'blocked'];

/**
 * Planifie l'enregistrement d'un verdict sur un cas de test.
 * Retourne `{ updates }` (status, testedBy/At, testNote, runs +1) ou `{ error }`.
 * Le re-test est toujours permis : un cas échoué peut repasser à `ready`
 * via l'édition puis recevoir un nouveau verdict (historique conservé).
 */
const planTestResult = (tc, result, { note = '', by = null, at = null } = {}) => {
  if (!tc) return { error: 'Cas de test introuvable.' };
  if (!TESTCASE_RESULTS.includes(result)) {
    return { error: 'Verdict invalide (passed, failed, blocked).' };
  }
  const run = { status: result, note: String(note || ''), by, at: at || new Date().toISOString() };
  return {
    updates: {
      status: result,
      testedBy: by,
      testedAt: run.at,
      testNote: run.note,
      runs: [...(tc.runs || []), run],
    },
  };
};

module.exports = { TESTCASE_STATUSES, TESTCASE_SEVERITIES, TESTCASE_RESULTS, planTestResult };

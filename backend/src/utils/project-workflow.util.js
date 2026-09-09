const { getWorkflow, canTransition } = require('../products/registry');

/**
 * Moteur de workflow GESTION DE PROJET.
 *
 * Source de vérité en cascade :
 *   1. Workflow personnalisé du projet (Project.workflow — configuré par le
 *      Project Admin, jamais codé en dur) ;
 *   2. Workflow du registre produit (products/registry.js) sinon.
 *
 * Aucune transition n'est validée sans permission : le moteur générique
 * canTransition() applique la permission de la transition (ou, pour un
 * workflow personnalisé, la permission `project.task.update` par défaut).
 */

/**
 * Workflow effectif d'un projet : états {key, label, color, order, terminal}
 * — la résolution i18n des états système se fait côté frontend via la clé
 * products.workflows.project_management.states.<key> ; un état personnalisé
 * porte son propre libellé saisi par l'utilisateur.
 */
function effectiveWorkflow(project) {
  const custom = Array.isArray(project?.workflow) && project.workflow.length > 0 ? project.workflow : null;
  if (custom) {
    return {
      custom: true,
      states: [...custom].sort((a, b) => (a.order || 0) - (b.order || 0)),
    };
  }
  const wf = getWorkflow('project_management');
  return {
    custom: false,
    states: wf ? wf.states.map((s) => ({ key: s.key, label: '', color: '', order: s.order, terminal: !!s.terminal })) : [],
  };
}

/**
 * États d'arrivée autorisés depuis un état donné, pour les permissions
 * fournies. Retourne la liste des transitions possibles { to, action, allowed }.
 */
function availableTransitions(project, from, permissions = []) {
  const wf = effectiveWorkflow(project);
  const fromState = wf.states.find((s) => s.key === from);
  if (!fromState) return [];
  if (fromState.terminal) return [];

  if (wf.custom) {
    // Workflow personnalisé : navigation libre vers tout état non terminal
    // (et vers un état terminal avec la permission de complétion).
    return wf.states
      .filter((s) => s.key !== from)
      .map((s) => ({
        to: s.key,
        action: s.terminal ? 'to_completed' : `to_${s.key}`,
        allowed: s.terminal
          ? permissions.includes('*') || permissions.includes('project.task.complete')
          : permissions.includes('*') || permissions.includes('project.task.update'),
      }));
  }

  const registryWf = getWorkflow('project_management');
  if (!registryWf) return [];
  return registryWf.transitions
    .filter((t) => t.from === from || t.from === '*')
    .map((t) => ({
      to: t.to,
      action: t.action || `to_${t.to}`,
      allowed:
        !t.requiredPermission ||
        permissions.includes('*') ||
        permissions.includes(t.requiredPermission),
    }));
}

/**
 * Valide une transition d'état de tâche. Retourne { ok, reason } avec les
 * mêmes raisons que le moteur générique (+ CUSTOM_TERMINAL pour les
 * workflows personnalisés dont l'état source est terminal).
 */
function validateTransition(project, from, to, permissions = []) {
  const wf = effectiveWorkflow(project);
  if (!wf.states.some((s) => s.key === from)) return { ok: false, reason: 'UNKNOWN_FROM' };
  if (!wf.states.some((s) => s.key === to)) return { ok: false, reason: 'UNKNOWN_TO' };
  const fromState = wf.states.find((s) => s.key === from);
  if (fromState.terminal) return { ok: false, reason: 'TERMINAL_FROM' };

  if (wf.custom) {
    const toState = wf.states.find((s) => s.key === to);
    const required = toState.terminal ? 'project.task.complete' : 'project.task.update';
    if (!(permissions.includes('*') || permissions.includes(required))) {
      return { ok: false, reason: 'PERMISSION_DENIED' };
    }
    return { ok: true, reason: 'OK' };
  }
  return canTransition('project_management', from, to, permissions);
}

/**
 * Clé i18n du libellé d'un état : clé système pour le workflow registre,
 * libellé libre pour un état personnalisé (renvoyé tel quel au frontend).
 */
function stateLabel(state) {
  if (state.label) return { custom: true, text: state.label };
  return { custom: false, key: `products.workflows.project_management.states.${state.key}` };
}

module.exports = { effectiveWorkflow, availableTransitions, validateTransition, stateLabel };

const { Utilisateur } = require('../models/user.model');
const { renderEmailLayout, FRONTEND_URL, ICONS } = require('./email-template');
const { sendEmail } = require('./email.service');
const { PLATFORM_NAME } = require('../config/branding');

/**
 * Emails de GESTION DE PROJET — gabarits bilingues FR/EN.
 *
 * La langue est choisie par destinataire (Utilisateur.language, défaut 'fr').
 * Les textes sont des gabarits traduits (jamais de contenu codé en dur dans
 * les contrôleurs) : chaque événement déclare un sujet + un corps dans les
 * deux langues, interpolés avec les paramètres de l'événement.
 */

const TEMPLATES = {
  project_invitation: {
    fr: {
      subject: 'Invitation au projet {{projectName}}',
      heading: 'Vous avez été ajouté à un projet',
      body: `Vous faites désormais partie de l'équipe du projet <strong>{{projectName}}</strong> ({{projectCode}}) avec le rôle <strong>{{role}}</strong>.`,
      cta: 'Ouvrir le projet',
    },
    en: {
      subject: 'Invitation to project {{projectName}}',
      heading: 'You have been added to a project',
      body: `You are now part of the <strong>{{projectName}}</strong> ({{projectCode}}) team with the <strong>{{role}}</strong> role.`,
      cta: 'Open the project',
    },
  },
  task_assigned: {
    fr: {
      subject: 'Tâche assignée : {{taskRef}} — {{taskTitle}}',
      heading: 'Une tâche vous a été assignée',
      body: `<strong>{{actor}}</strong> vous a assigné la tâche <strong>{{taskRef}}</strong> — {{taskTitle}} dans le projet {{projectName}}.{{#dueDate}} Échéance : <strong>{{dueDate}}</strong>.{{/dueDate}}`,
      cta: 'Voir la tâche',
    },
    en: {
      subject: 'Task assigned: {{taskRef}} — {{taskTitle}}',
      heading: 'A task has been assigned to you',
      body: `<strong>{{actor}}</strong> assigned you task <strong>{{taskRef}}</strong> — {{taskTitle}} in project {{projectName}}.{{#dueDate}} Due date: <strong>{{dueDate}}</strong>.{{/dueDate}}`,
      cta: 'View the task',
    },
  },
  task_reassigned: {
    fr: {
      subject: 'Tâche réaffectée : {{taskRef}}',
      heading: 'Une tâche a été réaffectée',
      body: `La tâche <strong>{{taskRef}}</strong> — {{taskTitle}} (projet {{projectName}}) est désormais assignée à <strong>{{newAssignee}}</strong>.`,
      cta: 'Voir la tâche',
    },
    en: {
      subject: 'Task reassigned: {{taskRef}}',
      heading: 'A task has been reassigned',
      body: `Task <strong>{{taskRef}}</strong> — {{taskTitle}} (project {{projectName}}) is now assigned to <strong>{{newAssignee}}</strong>.`,
      cta: 'View the task',
    },
  },
  task_mention: {
    fr: {
      subject: 'Mention dans {{taskTitle}}',
      heading: 'Vous avez été mentionné',
      body: `<strong>{{actor}}</strong> vous a mentionné dans un commentaire de {{taskTitle}} (projet {{projectName}}).`,
      cta: 'Voir le commentaire',
    },
    en: {
      subject: 'Mention in {{taskTitle}}',
      heading: 'You have been mentioned',
      body: `<strong>{{actor}}</strong> mentioned you in a comment on {{taskTitle}} (project {{projectName}}).`,
      cta: 'View the comment',
    },
  },
  task_comment: {
    fr: {
      subject: 'Nouveau commentaire : {{taskTitle}}',
      heading: 'Nouveau commentaire',
      body: `<strong>{{actor}}</strong> a commenté <strong>{{taskTitle}}</strong> (projet {{projectName}}).`,
      cta: 'Voir le commentaire',
    },
    en: {
      subject: 'New comment: {{taskTitle}}',
      heading: 'New comment',
      body: `<strong>{{actor}}</strong> commented on <strong>{{taskTitle}}</strong> (project {{projectName}}).`,
      cta: 'View the comment',
    },
  },
  task_deadline: {
    fr: {
      subject: 'Échéance proche : {{taskRef}} — {{taskTitle}}',
      heading: 'Échéance à venir',
      body: `La tâche <strong>{{taskRef}}</strong> — {{taskTitle}} (projet {{projectName}}) arrive à échéance le <strong>{{dueDate}}</strong>.`,
      cta: 'Voir la tâche',
    },
    en: {
      subject: 'Upcoming deadline: {{taskRef}} — {{taskTitle}}',
      heading: 'Upcoming deadline',
      body: `Task <strong>{{taskRef}}</strong> — {{taskTitle}} (project {{projectName}}) is due on <strong>{{dueDate}}</strong>.`,
      cta: 'View the task',
    },
  },
  task_overdue: {
    fr: {
      subject: 'Tâche en retard : {{taskRef}} — {{taskTitle}}',
      heading: 'Tâche en retard',
      body: `La tâche <strong>{{taskRef}}</strong> — {{taskTitle}} (projet {{projectName}}) est <strong>en retard</strong> depuis le {{dueDate}}.`,
      cta: 'Voir la tâche',
    },
    en: {
      subject: 'Overdue task: {{taskRef}} — {{taskTitle}}',
      heading: 'Overdue task',
      body: `Task <strong>{{taskRef}}</strong> — {{taskTitle}} (project {{projectName}}) has been <strong>overdue</strong> since {{dueDate}}.`,
      cta: 'View the task',
    },
  },
  task_status_changed: {
    fr: {
      subject: 'Statut mis à jour : {{taskRef}} — {{taskTitle}}',
      heading: 'Statut de tâche mis à jour',
      body: `<strong>{{actor}}</strong> a déplacé <strong>{{taskRef}}</strong> — {{taskTitle}} de « {{fromStatus}} » à « {{toStatus}} » (projet {{projectName}}).`,
      cta: 'Voir la tâche',
    },
    en: {
      subject: 'Status updated: {{taskRef}} — {{taskTitle}}',
      heading: 'Task status updated',
      body: `<strong>{{actor}}</strong> moved <strong>{{taskRef}}</strong> — {{taskTitle}} from “{{fromStatus}}” to “{{toStatus}}” (project {{projectName}}).`,
      cta: 'View the task',
    },
  },
  milestone_approaching: {
    fr: {
      subject: 'Jalon à venir : {{milestoneName}}',
      heading: 'Jalon à venir',
      body: `Le jalon <strong>{{milestoneName}}</strong> (projet {{projectName}}) est prévu pour le <strong>{{dueDate}}</strong>.`,
      cta: 'Voir le jalon',
    },
    en: {
      subject: 'Upcoming milestone: {{milestoneName}}',
      heading: 'Upcoming milestone',
      body: `Milestone <strong>{{milestoneName}}</strong> (project {{projectName}}) is scheduled for <strong>{{dueDate}}</strong>.`,
      cta: 'View the milestone',
    },
  },
  milestone_overdue: {
    fr: {
      subject: 'Jalon en retard : {{milestoneName}}',
      heading: 'Jalon en retard',
      body: `Le jalon <strong>{{milestoneName}}</strong> (projet {{projectName}}) est <strong>en retard</strong> depuis le {{dueDate}}.`,
      cta: 'Voir le jalon',
    },
    en: {
      subject: 'Overdue milestone: {{milestoneName}}',
      heading: 'Overdue milestone',
      body: `Milestone <strong>{{milestoneName}}</strong> (project {{projectName}}) has been <strong>overdue</strong> since {{dueDate}}.`,
      cta: 'View the milestone',
    },
  },
  project_role_changed: {
    fr: {
      subject: 'Rôle mis à jour : {{projectName}}',
      heading: 'Votre rôle a changé',
      body: `Votre rôle sur le projet <strong>{{projectName}}</strong> est désormais <strong>{{role}}</strong>.`,
      cta: 'Ouvrir le projet',
    },
    en: {
      subject: 'Role updated: {{projectName}}',
      heading: 'Your role has changed',
      body: `Your role on project <strong>{{projectName}}</strong> is now <strong>{{role}}</strong>.`,
      cta: 'Open the project',
    },
  },
  sprint_started: {
    fr: {
      subject: 'Sprint démarré : {{sprintName}}',
      heading: 'Le sprint est lancé',
      body: `Le sprint <strong>{{sprintName}}</strong> (projet {{projectName}}) a démarré{{#goal}} — objectif : « {{goal}} »{{/goal}}.`,
      cta: 'Voir le sprint',
    },
    en: {
      subject: 'Sprint started: {{sprintName}}',
      heading: 'The sprint has started',
      body: `Sprint <strong>{{sprintName}}</strong> (project {{projectName}}) has started{{#goal}} — goal: “{{goal}}”{{/goal}}.`,
      cta: 'View the sprint',
    },
  },
  sprint_completed: {
    fr: {
      subject: 'Sprint terminé : {{sprintName}}',
      heading: 'Sprint terminé',
      body: `Le sprint <strong>{{sprintName}}</strong> (projet {{projectName}}) est terminé. Pensez à la rétrospective !`,
      cta: 'Voir le sprint',
    },
    en: {
      subject: 'Sprint completed: {{sprintName}}',
      heading: 'Sprint completed',
      body: `Sprint <strong>{{sprintName}}</strong> (project {{projectName}}) is complete. Time for the retrospective!`,
      cta: 'View the sprint',
    },
  },
  risk_assigned: {
    fr: {
      subject: 'Risque assigné : {{riskTitle}}',
      heading: 'Un risque vous a été assigné',
      body: `Le risque <strong>{{riskTitle}}</strong> (gravité {{severity}}, projet {{projectName}}) vous a été assigné.`,
      cta: 'Voir le risque',
    },
    en: {
      subject: 'Risk assigned: {{riskTitle}}',
      heading: 'A risk has been assigned to you',
      body: `Risk <strong>{{riskTitle}}</strong> (severity {{severity}}, project {{projectName}}) has been assigned to you.`,
      cta: 'View the risk',
    },
  },
  issue_assigned: {
    fr: {
      subject: 'Problème assigné : {{issueTitle}}',
      heading: 'Un problème vous a été assigné',
      body: `Le problème <strong>{{issueTitle}}</strong> (priorité {{priority}}, projet {{projectName}}) vous a été assigné.`,
      cta: 'Voir le problème',
    },
    en: {
      subject: 'Issue assigned: {{issueTitle}}',
      heading: 'An issue has been assigned to you',
      body: `Issue <strong>{{issueTitle}}</strong> (priority {{priority}}, project {{projectName}}) has been assigned to you.`,
      cta: 'View the issue',
    },
  },
  subscription_purchase: {
    fr: {
      subject: 'Votre commande {{productName}} a été enregistrée',
      heading: 'Commande enregistrée',
      body: `Votre commande pour <strong>{{productName}}</strong> (plan {{plan}}, {{seats}} licences, {{total}}/{{period}}) a été enregistrée. L'activation interviendra après confirmation du paiement par la plateforme.`,
      cta: 'Mes abonnements',
    },
    en: {
      subject: 'Your {{productName}} order has been recorded',
      heading: 'Order recorded',
      body: `Your order for <strong>{{productName}}</strong> ({{plan}} plan, {{seats}} seats, {{total}}/{{period}}) has been recorded. Activation happens after payment confirmation by the platform.`,
      cta: 'My subscriptions',
    },
  },
  subscription_renewal: {
    fr: {
      subject: 'Renouvellement à venir : {{productName}}',
      heading: 'Renouvellement de souscription',
      body: `Votre souscription <strong>{{productName}}</strong> arrive à échéance le <strong>{{renewalDate}}</strong> ({{total}}).`,
      cta: 'Mes abonnements',
    },
    en: {
      subject: 'Upcoming renewal: {{productName}}',
      heading: 'Subscription renewal',
      body: `Your <strong>{{productName}}</strong> subscription renews on <strong>{{renewalDate}}</strong> ({{total}}).`,
      cta: 'My subscriptions',
    },
  },
  license_assigned: {
    fr: {
      subject: 'Accès activé : {{productName}}',
      heading: 'Votre licence est active',
      body: `Votre licence <strong>{{productName}}</strong> est active. Bienvenue !`,
      cta: 'Ouvrir le produit',
    },
    en: {
      subject: 'Access enabled: {{productName}}',
      heading: 'Your licence is active',
      body: `Your <strong>{{productName}}</strong> licence is now active. Welcome!`,
      cta: 'Open the product',
    },
  },
  license_removed: {
    fr: {
      subject: 'Accès révoqué : {{productName}}',
      heading: 'Votre licence a été révoquée',
      body: `Votre accès à <strong>{{productName}}</strong> a été révoqué. Vos données restent conservées.`,
      cta: 'Mes produits',
    },
    en: {
      subject: 'Access revoked: {{productName}}',
      heading: 'Your licence has been revoked',
      body: `Your access to <strong>{{productName}}</strong> has been revoked. Your data remains preserved.`,
      cta: 'My products',
    },
  },
  sprint_ending: {
    fr: {
      subject: 'Fin de sprint imminente : {{goal}}',
      heading: 'Le sprint se termine bientôt',
      body: `Le sprint <strong>{{goal}}</strong> du projet {{projectName}} se termine prochainement. Pensez à mettre à jour vos tâches avant la revue.`,
      cta: 'Voir le sprint',
    },
    en: {
      subject: 'Sprint ending soon: {{goal}}',
      heading: 'The sprint is ending soon',
      body: `Sprint <strong>{{goal}}</strong> in project {{projectName}} ends soon. Please update your tasks before the review.`,
      cta: 'View the sprint',
    },
  },
  project_completed: {
    fr: {
      subject: 'Projet terminé : {{projectName}}',
      heading: 'Un projet est terminé',
      body: `Le projet <strong>{{projectName}}</strong> ({{projectCode}}) a été marqué comme terminé. Félicitations à toute l'équipe !`,
      cta: 'Voir le projet',
    },
    en: {
      subject: 'Project completed: {{projectName}}',
      heading: 'A project has been completed',
      body: `Project <strong>{{projectName}}</strong> ({{projectCode}}) has been marked as completed. Congratulations to the whole team!`,
      cta: 'View the project',
    },
  },
  subscription_purchase: {
    fr: {
      subject: 'Demande d\'achat reçue : {{productName}}',
      heading: 'Votre demande a été transmise à la plateforme',
      body: `Votre demande pour <strong>{{productName}}</strong> (plan {{plan}}, {{seats}} siège(s), {{total}}) a été enregistrée. Elle est en attente d'approbation par la plateforme — paiement non requis pendant la bêta (approbation manuelle).`,
      cta: 'Suivre ma demande',
    },
    en: {
      subject: 'Purchase request received: {{productName}}',
      heading: 'Your request has been sent to the platform',
      body: `Your request for <strong>{{productName}}</strong> (plan {{plan}}, {{seats}} seat(s), {{total}}) has been recorded. It is pending platform approval — no payment required during beta (manual approval).`,
      cta: 'Track my request',
    },
  },
  subscription_requested: {
    fr: {
      subject: 'Nouvelle demande d\'achat : {{productName}}',
      heading: 'Une demande d\'achat attend votre approbation',
      body: `<strong>{{tenantName}}</strong> a demandé <strong>{{productName}}</strong> ({{seats}} siège(s)). Mode bêta : paiement non requis — approbation manuelle.`,
      cta: 'Examiner la demande',
    },
    en: {
      subject: 'New purchase request: {{productName}}',
      heading: 'A purchase request awaits your approval',
      body: `<strong>{{tenantName}}</strong> requested <strong>{{productName}}</strong> ({{seats}} seat(s)). Beta mode: no payment required — manual approval.`,
      cta: 'Review the request',
    },
  },
  subscription_approved: {
    fr: {
      subject: 'Demande approuvée : {{productName}}',
      heading: 'Votre produit est activé',
      body: `Votre demande pour <strong>{{productName}}</strong> a été approuvée : la souscription ({{seats}} sièges) est active et vous pouvez assigner les licences à vos utilisateurs.`,
      cta: 'Gérer mes licences',
    },
    en: {
      subject: 'Request approved: {{productName}}',
      heading: 'Your product is now active',
      body: `Your request for <strong>{{productName}}</strong> has been approved: the subscription ({{seats}} seats) is active and you can assign licences to your users.`,
      cta: 'Manage my licences',
    },
  },
  subscription_rejected: {
    fr: {
      subject: 'Demande refusée : {{productName}}',
      heading: 'Votre demande n\'a pas été approuvée',
      body: `Votre demande pour <strong>{{productName}}</strong> a été refusée par la plateforme.{{#note}} Motif : {{note}}.{{/note}}`,
      cta: 'Voir mes demandes',
    },
    en: {
      subject: 'Request rejected: {{productName}}',
      heading: 'Your request was not approved',
      body: `Your request for <strong>{{productName}}</strong> was rejected by the platform.{{#note}} Reason: {{note}}.{{/note}}`,
      cta: 'View my requests',
    },
  },
  subscription_expiring: {
    fr: {
      subject: 'Expiration prochaine : {{productName}}',
      heading: 'Votre souscription expire bientôt',
      body: `Votre souscription <strong>{{productName}}</strong> arrive à échéance le {{endDate}}. Pensez à la renouveler pour conserver l'accès de vos équipes.`,
      cta: 'Mes abonnements',
    },
    en: {
      subject: 'Expiring soon: {{productName}}',
      heading: 'Your subscription is expiring soon',
      body: `Your <strong>{{productName}}</strong> subscription ends on {{endDate}}. Renew it to keep your teams' access.`,
      cta: 'My subscriptions',
    },
  },
  license_limit_reached: {
    fr: {
      subject: 'Limite de licences atteinte : {{productName}}',
      heading: 'Tous vos sièges sont assignés',
      body: `Les {{seats}} sièges de <strong>{{productName}}</strong> sont tous assignés ({{used}} utilisés). Demandez des sièges supplémentaires pour ajouter des utilisateurs.`,
      cta: 'Demander des sièges',
    },
    en: {
      subject: 'Licence limit reached: {{productName}}',
      heading: 'All your seats are assigned',
      body: `All {{seats}} seats of <strong>{{productName}}</strong> are assigned ({{used}} used). Request additional seats to add more users.`,
      cta: 'Request seats',
    },
  },
};

/** Interpolation simplifiée : {{key}} + sections conditionnelles {{#key}}…{{/key}}. */
function interpolate(tpl, params) {
  let out = String(tpl);
  out = out.replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, body) =>
    params[key] ? body : ''
  );
  out = out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key) =>
    params[key] !== undefined && params[key] !== null ? String(params[key]) : ''
  );
  return out;
}

/**
 * Envoie l'email d'un événement à un utilisateur, dans SA langue
 * (Utilisateur.language, défaut 'fr'). Silencieux si l'utilisateur est
 * introuvable/suspendu — l'envoi réel dépend de la config SMTP (email.service).
 */
async function sendProjectEventEmail(userId, event, params = {}) {
  const user = await Utilisateur.findById(userId).select('email language firstName lastName status').lean();
  if (!user || user.status === 'suspended' || !user.email) return false;
  const tpl = TEMPLATES[event];
  if (!tpl) return false;
  const lang = user.language === 'en' ? 'en' : 'fr';
  const copy = tpl[lang];
  const subject = interpolate(copy.subject, params);
  const body = interpolate(copy.body, params);
  const ctaUrl = params.link ? `${FRONTEND_URL()}${params.link}` : FRONTEND_URL();
  const html = renderEmailLayout({
    preheader: subject,
    icon: ICONS.board,
    heading: interpolate(copy.heading, params),
    bodyHtml: `<p style="margin:0 0 12px;">${lang === 'fr' ? 'Bonjour' : 'Hello'} ${user.firstName || ''},</p>
      <p style="margin:0;">${body}</p>`,
    ctaLabel: copy.cta,
    ctaUrl,
  });
  await sendEmail(user.email, `${subject} — ${PLATFORM_NAME}`, html);
  return true;
}

module.exports = { sendProjectEventEmail, TEMPLATES };

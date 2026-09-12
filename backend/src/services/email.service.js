const nodemailer = require('nodemailer');
const { PLATFORM_NAME, PLATFORM_LOG_TAG } = require('../config/branding');
const { Utilisateur } = require('../models/user.model');
const { renderEmailLayout, FRONTEND_URL, ICONS } = require('./email-template');
let transporter = null;
let smtpWarned = false;

/**
 * SMTP activé uniquement si configuré avec un vrai hôte. Un .env copié-collé
 * depuis l'exemple (smtp.example.com) ne doit PAS déclencher de tentatives de
 * connexion à un domaine factice (erreurs répétées et pauses DNS en dev).
 */
const smtpConfigured = () =>
  !!process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.example.com';

/**
 * Renvoie (et met en cache) le transporteur Nodemailer configuré via SMTP.
 */
const getTransporter = () => {
  if (!transporter) {
    const secure = process.env.SMTP_SECURE === 'true';
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // MAIL-002 (audit) : en dehors du TLS implicite (port 465 / secure),
      // EXIGER STARTTLS — jamais d'envoi en clair. La vérification du
      // certificat serveur reste activée (rejet des certificats invalides).
      requireTLS: !secure,
      tls: { rejectUnauthorized: true },
    });
  }
  return transporter;
};

/**
 * Envoi générique d'un email. Les erreurs sont simplement journalisées
 * (opération non bloquante vis-à-vis de l'appelant). Sans configuration SMTP
 * réelle, l'envoi est ignoré silencieusement (avertissement unique au premier
 * email) : la plateforme reste pleinement utilisable en développement.
 */
const sendEmail = async (to, subject, html) => {
  if (!smtpConfigured()) {
    if (!smtpWarned) {
      console.warn(
        `${PLATFORM_LOG_TAG} SMTP non configuré (SMTP_HOST) — les emails sont désactivés. ` +
          'Configurez le serveur SMTP dans .env pour les activer.'
      );
      smtpWarned = true;
    }
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`${PLATFORM_LOG_TAG} Erreur lors de l'envoi de l'email :`, err);
  }
};

/**
 * Email de réinitialisation de mot de passe (asynchrone, non bloquant).
 * Lien : http://localhost:4200/reset-password?token=...
 */
const sendResetPasswordEmail = async (email, token) => {
  const link = `${FRONTEND_URL()}/reset-password?token=${token}`;
  const html = renderEmailLayout({
    preheader: `Réinitialisez votre mot de passe ${PLATFORM_NAME} (valable 1 heure).`,
    icon: ICONS.lock,
    heading: 'Réinitialisation de votre mot de passe',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p style="margin: 0;">Cliquez sur le bouton ci-dessous pour en définir un nouveau. Ce lien est valable
      <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email
      en toute sécurité.</p>`,
    ctaLabel: 'Réinitialiser mon mot de passe',
    ctaUrl: link,
  });
  await sendEmail(email, `Réinitialisation de votre mot de passe ${PLATFORM_NAME}`, html);
};

/**
 * Notification asynchrone à l'équipe de traitement du tenant :
 * Agents opérationnels + Tenant Admin (destinataires internes au tenant).
 */
const sendSupportEmail = async (tenantId, subject, html) => {
  try {
    const recipients = [];

    const supportUsers = await Utilisateur.find({
      tenantId,
      role: { $in: ['AGENT', 'TENANT_ADMIN'] },
      status: { $ne: 'suspended' },
    }).select('email');

    recipients.push(...supportUsers.map((user) => user.email));

    // Suppression des doublons
    const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

    if (uniqueRecipients.length === 0) {
      return;
    }

    await sendEmail(uniqueRecipients.join(','), subject, html);
  } catch (err) {
    console.error(
      `${PLATFORM_LOG_TAG} Erreur lors de la notification de l'équipe de traitement :`,
      err
    );
  }
};

/**
 * Notification de sécurité : la double authentification vient d'être activée.
 */
const sendTwoFactorEnabledEmail = async (email) => {
  const html = renderEmailLayout({
    preheader: `La double authentification est activée sur votre compte ${PLATFORM_NAME}.`,
    icon: ICONS.lock,
    heading: 'Double authentification activée',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">La double authentification (2FA) a été <strong>activée</strong> sur votre compte.
      Votre application d'authentification vous demandera désormais un code à 6 chiffres à chaque connexion.</p>
      <p style="margin: 0;">Si vous n'êtes pas à l'origine de cette action, contactez immédiatement votre
      administrateur et réinitialisez votre mot de passe.</p>`,
    ctaLabel: 'Accéder à mon espace',
    ctaUrl: FRONTEND_URL(),
  });
  await sendEmail(email, `Double authentification activée — ${PLATFORM_NAME}`, html);
};

/**
 * Notification de sécurité : la double authentification vient d'être désactivée.
 */
const sendTwoFactorDisabledEmail = async (email) => {
  const html = renderEmailLayout({
    preheader: `La double authentification a été désactivée sur votre compte ${PLATFORM_NAME}.`,
    icon: ICONS.lock,
    heading: 'Double authentification désactivée',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">La double authentification (2FA) a été <strong>désactivée</strong> sur votre compte.
      Votre mot de passe suffit désormais pour vous connecter.</p>
      <p style="margin: 0;">Si vous n'êtes pas à l'origine de cette action, contactez immédiatement votre
      administrateur et réinitialisez votre mot de passe.</p>`,
    ctaLabel: 'Accéder à mon espace',
    ctaUrl: FRONTEND_URL(),
  });
  await sendEmail(email, `Double authentification désactivée — ${PLATFORM_NAME}`, html);
};

/**
 * MAIL-003 (audit) : confirmation de sécurité — le mot de passe vient d'être
 * modifié (par l'utilisateur ou via réinitialisation). Permet de détecter une
 * prise de contrôle de compte.
 */
const sendPasswordChangedEmail = async (email) => {
  const html = renderEmailLayout({
    preheader: `Le mot de passe de votre compte ${PLATFORM_NAME} a été modifié.`,
    icon: ICONS.lock,
    heading: 'Mot de passe modifié',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">Le mot de passe de votre compte a été <strong>modifié avec succès</strong>.
      Toutes vos sessions actives ont été révoquées : une nouvelle connexion est nécessaire.</p>
      <p style="margin: 0;">Si vous n'êtes pas à l'origine de cette action, contactez immédiatement votre
      administrateur : votre compte a peut-être été compromis.</p>`,
    ctaLabel: 'Accéder à mon espace',
    ctaUrl: FRONTEND_URL(),
  });
  await sendEmail(email, `Mot de passe modifié — ${PLATFORM_NAME}`, html);
};

module.exports = { sendEmail, sendResetPasswordEmail, sendSupportEmail, sendTwoFactorEnabledEmail, sendTwoFactorDisabledEmail, sendPasswordChangedEmail };

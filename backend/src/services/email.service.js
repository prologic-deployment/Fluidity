const nodemailer = require('nodemailer');
const { PLATFORM_NAME, PLATFORM_LOG_TAG } = require('../config/branding');
const { Utilisateur } = require('../models/user.model');
const { renderEmailLayout, FRONTEND_URL, ICONS } = require('./email-template');
let transporter = null;

/**
 * Renvoie (et met en cache) le transporteur Nodemailer configuré via SMTP.
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Envoi générique d'un email. Les erreurs sont simplement journalisées
 * (opération non bloquante vis-à-vis de l'appelant).
 */
const sendEmail = async (to, subject, html) => {
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

module.exports = { sendEmail, sendResetPasswordEmail, sendSupportEmail };

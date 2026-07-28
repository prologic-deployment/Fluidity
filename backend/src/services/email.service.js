const nodemailer = require('nodemailer');
const { Utilisateur } = require('../models/user.model');
const { renderEmailLayout, FRONTEND_URL, ICONS, brandFromTenant } = require('./email-template');
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
    console.error("[Platform] Erreur lors de l'envoi de l'email :", err);
  }
};

/**
 * Email de réinitialisation de mot de passe (asynchrone, non bloquant).
 * Lien : http://localhost:4200/reset-password?token=...
 *
 * @param {string} email
 * @param {string} token
 * @param {Object} [tenant] - Document Tenant du compte (pour un email à la marque du Tenant, voir "WHITE LABEL SUPPORT")
 */
const sendResetPasswordEmail = async (email, token, tenant) => {
  const link = `${FRONTEND_URL()}/reset-password?token=${token}`;
  const brand = brandFromTenant(tenant);
  const brandName = brand?.name || 'votre espace de travail';
  const html = renderEmailLayout({
    preheader: `Réinitialisez votre mot de passe (valable 1 heure).`,
    icon: ICONS.lock,
    heading: 'Réinitialisation de votre mot de passe',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">Vous avez demandé la réinitialisation de votre mot de passe pour ${brandName}.</p>
      <p style="margin: 0;">Cliquez sur le bouton ci-dessous pour en définir un nouveau. Ce lien est valable
      <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email
      en toute sécurité.</p>`,
    ctaLabel: 'Réinitialiser mon mot de passe',
    ctaUrl: link,
    brand,
  });
  await sendEmail(email, 'Réinitialisation de votre mot de passe', html);
};

/**
 * Notification asynchrone à l'équipe Support N1 (helpdesk) du tenant
 * concerné — l'email reprend la marque de ce Tenant si `tenant` est fourni.
 */
const sendSupportEmail = async (tenantId, subject, html) => {
  try {
    // Email du helpdesk + utilisateurs SUPPORT_N1
    const recipients = [];

    const supportUsers = await Utilisateur.find({
      tenantId,
      role: 'SUPPORT_N1',
    }).select('email');

    recipients.push(...supportUsers.map((user) => user.email));

    // Suppression des doublons
    const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

    if (uniqueRecipients.length === 0) {
      return;
    }

    await sendEmail(uniqueRecipients.join(','), subject, html);
  } catch (err) {
    console.error('[Platform] Erreur lors de la notification du Support N1 :', err);
  }
};

module.exports = { sendEmail, sendResetPasswordEmail, sendSupportEmail };

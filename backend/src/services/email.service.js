const nodemailer = require('nodemailer');
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
    console.error("[Fluidity] Erreur lors de l'envoi de l'email :", err);
  }
};

/**
 * Email de réinitialisation de mot de passe (asynchrone, non bloquant).
 * Lien : http://localhost:4200/reset-password?token=...
 */
const sendResetPasswordEmail = async (email, token) => {
  const link = `${FRONTEND_URL()}/reset-password?token=${token}`;
  const html = renderEmailLayout({
    preheader: 'Réinitialisez votre mot de passe Fluidity (valable 1 heure).',
    icon: ICONS.lock,
    heading: 'Réinitialisation de votre mot de passe',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour,</p>
      <p style="margin: 0 0 10px;">Vous avez demandé la réinitialisation de votre mot de passe Fluidity.</p>
      <p style="margin: 0;">Cliquez sur le bouton ci-dessous pour en définir un nouveau. Ce lien est valable
      <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email
      en toute sécurité.</p>`,
    ctaLabel: 'Réinitialiser mon mot de passe',
    ctaUrl: link,
  });
  await sendEmail(email, 'Réinitialisation de votre mot de passe Fluidity', html);
};

/**
 * Email de bienvenue envoyé à un client nouvellement provisionné, avec ses
 * identifiants temporaires et l'instruction de changer son mot de passe.
 * Le mot de passe en clair est transmis UNE SEULE FOIS via ce canal, puis
 * immédiatement oublié côté serveur.
 */
const sendClientAccountEmail = async (client, temporaryPassword) => {
  const html = renderEmailLayout({
    preheader: 'Votre accès au portail Fluidity est prêt.',
    icon: ICONS.fileCheck,
    heading: 'Bienvenue sur Fluidity',
    bodyHtml: `
      <p style="margin: 0 0 10px;">Bonjour ${client.nom || ''},</p>
      <p style="margin: 0 0 10px;">Votre compte a été créé. Utilisez les identifiants ci-dessous pour vous connecter au portail :</p>
      <table style="margin: 0 0 12px; width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 8px; color: #64748b;">Adresse de connexion</td>
          <td style="padding: 6px 8px; font-weight: 600;">${FRONTEND_URL()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 8px; color: #64748b;">Email</td>
          <td style="padding: 6px 8px; font-weight: 600;">${client.email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 8px; color: #64748b;">Mot de passe temporaire</td>
          <td style="padding: 6px 8px; font-weight: 600; font-family: monospace;">${temporaryPassword}</td>
        </tr>
      </table>
      <p style="margin: 0;">Pour des raisons de sécurité, vous devrez <strong>changer votre mot de passe
      temporaire</strong> lors de votre première connexion.</p>`,
    ctaLabel: 'Accéder au portail',
    ctaUrl: `${FRONTEND_URL()}/login`,
  });
  await sendEmail(client.email, 'Votre accès au portail Fluidity', html);
};

/**
 * Notification asynchrone à l'équipe Support (helpdesk).
 */
const sendSupportEmail = async (subject, html) => {
  try {
    // Utilisateurs du support (SUPPORT_N1 + responsables)
    const recipients = [];

    const supportUsers = await Utilisateur.find({
      role: { $in: ['SUPPORT_N1', 'RESPONSABLE_TECHNIQUE'] },
    }).select('email');

    recipients.push(...supportUsers.map(user => user.email));

    // Suppression des doublons
    const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

    if (uniqueRecipients.length === 0) {
      return;
    }

    await sendEmail(uniqueRecipients.join(','), subject, html);
  } catch (err) {
    console.error(
      '[Fluidity] Erreur lors de la notification du Support N1 :',
      err
    );
  }
};

module.exports = { sendEmail, sendResetPasswordEmail, sendSupportEmail, sendClientAccountEmail };

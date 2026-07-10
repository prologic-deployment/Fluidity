import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Renvoie (et met en cache) le transporteur Nodemailer configuré via SMTP.
 */
const getTransporter = (): Transporter => {
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
export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[Fluidity] Erreur lors de l\'envoi de l\'email :', err);
  }
};

/**
 * Email de réinitialisation de mot de passe (asynchrone, non bloquant).
 * Lien : http://localhost:4200/reset-password?token=...
 */
export const sendResetPasswordEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const link = `${frontendUrl}/reset-password?token=${token}`;
  const html = `
    <div>
      <h2>Réinitialisation de votre mot de passe Fluidity</h2>
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le lien ci-dessous pour en définir un nouveau (valable 1 heure) :</p>
      <p><a href="${link}">${link}</a></p>
      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
    </div>`;
  await sendEmail(email, 'Réinitialisation de votre mot de passe Fluidity', html);
};

/**
 * Notification asynchrone à l'équipe Support N1 (helpdesk).
 */
export const sendSupportEmail = async (
  subject: string,
  html: string
): Promise<void> => {
  await sendEmail('helpdesk@company.com', subject, html);
};

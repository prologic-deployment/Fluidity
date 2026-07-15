/**
 * Gabarit d'email HTML partagé, aligné sur l'identité visuelle de
 * l'application (dégradé indigo → violet de la sidebar, badge "F",
 * typographie Inter/sans-serif, coins arrondis). Écrit en HTML "email-safe"
 * (styles inline, pas de CSS externe) pour un rendu fiable dans les
 * principaux clients de messagerie.
 */

/**
 * Palette alignée pixel pour pixel sur les variables CSS de l'application
 * (frontend/src/styles.css, section :root). Convertie une fois en hex ici
 * pour un usage dans du HTML email (styles inline, pas de var() CSS).
 */
const COLORS = {
  primary: '#4f46e5', // hsl(var(--primary))      — indigo-600
  violet: '#7c3aed', // fin de dégradé (boutons/sidebar) — violet-600
  text: '#0f172a', // hsl(var(--foreground))
  muted: '#64748b', // hsl(var(--muted-foreground))
  border: '#e2e8f0', // hsl(var(--border))
  bg: '#f8fafc', // proche de hsl(var(--muted)), fond de page email
  destructive: '#ef4444', // hsl(var(--destructive))
  warning: '#d97706', // hsl(var(--warning))
  success: '#15803d', // hsl(var(--success))
};

const BRAND_GRADIENT = `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.violet} 100%)`;
const TEXT_COLOR = COLORS.text;
const MUTED_COLOR = COLORS.muted;
const BORDER_COLOR = COLORS.border;
const BG_COLOR = COLORS.bg;

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:4200';

/**
 * Enveloppe le contenu (déjà en HTML) dans le gabarit de marque Fluidity.
 *
 * @param {Object} options
 * @param {string} options.preheader - Texte d'aperçu (invisible, avant le corps)
 * @param {string} options.heading - Titre affiché sous le bandeau
 * @param {string} options.bodyHtml - Corps du message (HTML déjà construit)
 * @param {string} [options.ctaLabel] - Libellé du bouton d'action (optionnel)
 * @param {string} [options.ctaUrl] - URL du bouton d'action (optionnel)
 */
function renderEmailLayout({ preheader = '', heading, bodyHtml, ctaLabel, ctaUrl }) {
  const cta =
    ctaLabel && ctaUrl
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 4px;">
      <tr>
        <td style="border-radius: 8px; background: ${BRAND_GRADIENT};">
          <a href="${ctaUrl}" target="_blank"
            style="display:inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600;
            color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${ctaLabel} →
          </a>
        </td>
      </tr>
    </table>`
      : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${heading}</title>
</head>
<body style="margin:0; padding:0; background:${BG_COLOR}; font-family: -apple-system, 'Segoe UI', Inter, Helvetica, Arial, sans-serif;">
  <span style="display:none; font-size:1px; color:${BG_COLOR}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${preheader}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_COLOR}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background:#ffffff; border-radius: 16px; overflow:hidden; border: 1px solid ${BORDER_COLOR};">

          <!-- Bandeau de marque -->
          <tr>
            <td style="background: ${BRAND_GRADIENT}; padding: 28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px; height:36px; background: rgba(255,255,255,0.18); border-radius: 10px; text-align:center; vertical-align:middle;">
                    <span style="color:#ffffff; font-size:18px; font-weight:700; line-height:36px;">F</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color:#ffffff; font-size:16px; font-weight:700; letter-spacing:-0.01em;">Fluidity</span><br/>
                    <span style="color:rgba(255,255,255,0.75); font-size:11px;">Cloud Services Management Portal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin:0 0 16px; font-size: 18px; font-weight:700; color:${TEXT_COLOR};">${heading}</h1>
              <div style="font-size: 14px; line-height: 1.6; color:${TEXT_COLOR};">
                ${bodyHtml}
              </div>
              ${cta}
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid ${BORDER_COLOR}; background:#fafafa;">
              <p style="margin:0; font-size: 12px; color:${MUTED_COLOR};">
                Cet email a été envoyé automatiquement par le portail Fluidity. Merci de ne pas y répondre directement.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Petit badge coloré (statut, priorité, type...) pour usage dans un email. */
function renderBadge(text, color = COLORS.primary) {
  return `<span style="display:inline-block; padding: 3px 10px; border-radius:999px; font-size:12px; font-weight:600; color:${color}; background:${color}1a;">${text}</span>`;
}

/** Tableau clé/valeur discret (détails d'une demande/changement) pour usage dans un email. */
function renderDetailsTable(rows) {
  const items = rows
    .filter((r) => r && r.value !== undefined && r.value !== null && r.value !== '')
    .map(
      (r) => `
      <tr>
        <td style="padding: 9px 0; border-bottom: 1px solid ${BORDER_COLOR}; font-size:12px; color:${MUTED_COLOR}; width: 40%; vertical-align:top;">${r.label}</td>
        <td style="padding: 9px 0; border-bottom: 1px solid ${BORDER_COLOR}; font-size:13px; color:${TEXT_COLOR}; font-weight:500;">${r.value}</td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">${items}</table>`;
}

module.exports = { renderEmailLayout, renderBadge, renderDetailsTable, FRONTEND_URL, COLORS };

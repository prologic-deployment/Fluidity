/**
 * Gabarit d'email HTML partagé, aligné sur l'identité visuelle de
 * l'application (dégradé indigo → violet, badge "F", coins arrondis,
 * badges à point de couleur, tableau de détail façon "carte"). Écrit en
 * HTML "email-safe" avec deux contraintes strictes de compatibilité :
 *
 * 1. Aucun SVG. Beaucoup de clients mail (Outlook desktop en tête) ne
 *    rendent pas les SVG inline : ils affichent un cadre vide. Les
 *    pictogrammes sont donc de simples caractères en gras (police système),
 *    garantis de s'afficher partout.
 * 2. Chaque `background: linear-gradient(...)` est TOUJOURS précédé d'un
 *    `background-color` uni de repli. Les clients qui ignorent la
 *    propriété `background` (dégradé) affichent alors la couleur unie au
 *    lieu d'un fond blanc/transparent (texte blanc devenu invisible).
 *
 * Le mode sombre est pris en charge via `prefers-color-scheme`.
 */

/**
 * Palette alignée pixel pour pixel sur les variables CSS de l'application
 * (frontend/src/styles.css, section :root), converties une fois en hex ici.
 */
const COLORS = {
  primary: '#4f46e5', // hsl(var(--primary))      — indigo-600
  violet: '#7c3aed', // fin de dégradé (boutons/sidebar) — violet-600
  text: '#0f172a', // hsl(var(--foreground))
  muted: '#64748b', // hsl(var(--muted-foreground))
  border: '#e2e8f0', // hsl(var(--border))
  bg: '#f1f5f9', // proche de hsl(var(--muted))
  card: '#ffffff',
  destructive: '#ef4444', // hsl(var(--destructive))
  warning: '#d97706', // hsl(var(--warning))
  success: '#15803d', // hsl(var(--success))
};

/** Mêmes rôles sémantiques, valeurs adaptées au mode sombre (proche de la sidebar). */
const DARK = {
  bg: '#0b0a1f',
  card: '#17152f',
  text: '#f1f5f9',
  muted: '#aab1cc',
  border: 'rgba(255,255,255,0.16)',
  boxBg: 'rgba(255,255,255,0.07)',
};

// Fond de repli uni utilisé par tout élément qui porte un dégradé de marque
// (voir note de compatibilité en tête de fichier).
const BRAND_SOLID = COLORS.primary;
const BRAND_GRADIENT = `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.violet} 100%)`;
// Déclaration CSS prête à l'emploi : couleur unie PUIS dégradé, pour repli propre.
const BRAND_BG_DECLARATION = `background-color: ${BRAND_SOLID}; background: ${BRAND_GRADIENT};`;

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:4200';

/**
 * Badge circulaire "hero" (lettre en gras, pas de SVG) qui chevauche
 * légèrement le bas du bandeau de marque, centré au-dessus du titre.
 */
function renderHeroIcon(letter) {
  if (!letter) return '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: -28px;">
            <tr>
              <td class="email-card email-border" align="center" valign="middle"
                style="width:56px; height:56px; border-radius:14px; background-color:${COLORS.card};
                border:1px solid ${COLORS.border}; box-shadow: 0 6px 16px rgba(79,70,229,0.18);">
                <table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" valign="middle"
                            style="width:30px; height:30px; border-radius:9px; ${BRAND_BG_DECLARATION}">
                            <span style="display:block; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:30px; font-weight:700; color:#ffffff;">${letter}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Enveloppe le contenu (déjà en HTML) dans le gabarit de marque Fluidity.
 * Prend en charge le mode sombre via `prefers-color-scheme` (classes
 * `email-*` surchargées dans le <style> pour les clients qui le lisent ;
 * dégrade proprement vers le mode clair sinon).
 *
 * @param {Object} options
 * @param {string} options.preheader - Texte d'aperçu (invisible, avant le corps)
 * @param {string} [options.icon] - Lettre affichée dans le badge circulaire sous le bandeau (ex: "R", "D")
 * @param {string} options.heading - Titre affiché sous le bandeau
 * @param {string} options.bodyHtml - Corps du message (HTML déjà construit)
 * @param {string} [options.ctaLabel] - Libellé du bouton d'action (optionnel)
 * @param {string} [options.ctaUrl] - URL du bouton d'action (optionnel)
 */
function renderEmailLayout({ preheader = '', icon = '', heading, bodyHtml, ctaLabel, ctaUrl }) {
  const heroIcon = renderHeroIcon(icon);
  const align = icon ? 'center' : 'left';

  const cta =
    ctaLabel && ctaUrl
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" align="${icon ? 'center' : 'left'}" style="margin: 24px auto 4px;">
      <tr>
        <td align="center" style="border-radius: 8px; ${BRAND_BG_DECLARATION}">
          <a href="${ctaUrl}" target="_blank"
            style="display:inline-block; padding: 12px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700;
            color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${ctaLabel} &rarr;
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
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${heading}</title>
<!--[if mso]>
<style>
  table, td { border-collapse: collapse; }
  .email-fallback-bg { background-color: ${BRAND_SOLID} !important; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  img { border: 0; outline: none; text-decoration: none; }
  a { color: inherit; }

  /* ---- Mode sombre : surcharge des classes email-* pour les clients qui le supportent ---- */
  @media (prefers-color-scheme: dark) {
    .email-bg         { background: ${DARK.bg} !important; }
    .email-card       { background-color: ${DARK.card} !important; }
    .email-text       { color: ${DARK.text} !important; }
    .email-muted      { color: ${DARK.muted} !important; }
    .email-border     { border-color: ${DARK.border} !important; }
    .email-box-bg     { background-color: ${DARK.boxBg} !important; }
  }
  [data-ogsc] .email-bg    { background: ${DARK.bg} !important; }
  [data-ogsc] .email-card  { background-color: ${DARK.card} !important; }
  [data-ogsc] .email-text  { color: ${DARK.text} !important; }
  [data-ogsc] .email-muted { color: ${DARK.muted} !important; }
  [data-ogsc] .email-box-bg { background-color: ${DARK.boxBg} !important; }
</style>
</head>
<body class="email-bg" style="margin:0; padding:0; background-color:${COLORS.bg}; font-family: Arial, Helvetica, 'Segoe UI', sans-serif;">
  <span style="display:none; font-size:1px; color:${COLORS.bg}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${preheader}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:${COLORS.bg}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">

          <!-- Bandeau de marque -->
          <tr>
            <td align="center" style="${BRAND_BG_DECLARATION} padding: 22px 32px; border-radius: 16px 16px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:34px; height:34px; background-color: rgba(255,255,255,0.18); border-radius: 9px; text-align:center; vertical-align:middle;">
                    <span style="display:block; font-family: Arial, Helvetica, sans-serif; color:#ffffff; font-size:16px; font-weight:700; line-height:34px;">F</span>
                  </td>
                  <td style="padding-left: 11px;">
                    <span style="font-family: Arial, Helvetica, sans-serif; color:#ffffff; font-size:15px; font-weight:700;">Fluidity</span><br/>
                    <span style="font-family: Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.8); font-size:11px;">Cloud Services Management Portal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Carte de contenu -->
          <tr>
            <td class="email-card email-border" style="background-color:${COLORS.card}; border-radius: 0 0 16px 16px; border: 1px solid ${COLORS.border}; border-top:none;">
              ${heroIcon}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: ${icon ? '16px 32px 30px' : '32px 32px 30px'}; text-align:${align};">
                    <h1 class="email-text" style="margin:0 0 14px; font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight:700; color:${COLORS.text};">${heading}</h1>
                    <div class="email-text" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.65; color:${COLORS.text}; text-align:left;">
                      ${bodyHtml}
                    </div>
                    ${cta}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding: 22px 8px 0;">
              <p class="email-muted" style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color:${COLORS.muted}; text-align:center; line-height:1.6;">
                Cet email a été envoyé automatiquement par le portail Fluidity.<br/>Merci de ne pas y répondre directement.
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

/** Petit badge coloré à point (statut, priorité, type...) pour usage dans un email. */
function renderBadge(text, color = COLORS.primary) {
  return `<span style="display:inline-block; padding: 4px 12px 4px 9px; border-radius:999px; font-family: Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; color:${color}; background-color:${color}26; white-space:nowrap;">
    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${color}; margin-right:6px; vertical-align:middle;">&nbsp;</span><span style="vertical-align:middle;">${text}</span>
  </span>`;
}

/**
 * Tableau clé/valeur dans un encart arrondi (façon carte de détail de
 * l'application) pour usage dans un email.
 */
function renderDetailsTable(rows) {
  const filtered = rows.filter((r) => r && r.value !== undefined && r.value !== null && r.value !== '');
  const items = filtered
    .map((r, i) => {
      const borderTop = i > 0 ? `border-top: 1px solid ${COLORS.border};` : '';
      return `
      <tr>
        <td class="email-muted email-border" style="padding: 10px 14px; ${borderTop} font-family: Arial, Helvetica, sans-serif; font-size:12px; color:${COLORS.muted}; width: 42%; vertical-align:top;">${r.label}</td>
        <td class="email-text email-border" style="padding: 10px 14px; ${borderTop} font-family: Arial, Helvetica, sans-serif; font-size:13px; color:${COLORS.text}; font-weight:700;">${r.value}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    class="email-box-bg email-border"
    style="margin: 14px 0 4px; background-color:${COLORS.bg}; border-radius: 10px; border: 1px solid ${COLORS.border};">
    ${items}
  </table>`;
}

/** Lettres utilisées dans le badge circulaire d'en-tête, une par type d'email (pas de SVG). */
const ICONS = {
  lock: 'R', // Réinitialisation de mot de passe
  fileCheck: 'D', // Nouvelle Demande
  refresh: 'C', // Nouveau Changement
  exchange: 'S', // changement de Statut
};

module.exports = { renderEmailLayout, renderBadge, renderDetailsTable, FRONTEND_URL, COLORS, ICONS };

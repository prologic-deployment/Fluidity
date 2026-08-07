/**
 * Analyse d'un User-Agent HTTP : navigateur (nom + version majeure),
 * système d'exploitation, type d'appareil. Auto-suffisant (aucune
 * dépendance externe) — couvre les navigateurs/OS courants ; tout ce qui
 * n'est pas reconnu retombe proprement sur « Inconnu ».
 */

const NAVIGATEURS = [
  { nom: 'Edge', motif: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { nom: 'Opera', motif: /(?:OPR|Opera)\/(\d+)/ },
  { nom: 'Chrome', motif: /(?:Chrome|CriOS)\/(\d+)/ },
  { nom: 'Firefox', motif: /Firefox\/(\d+)/ },
  // iOS insère « Mobile/<build> » entre la version et « Safari »
  { nom: 'Safari', motif: /Version\/(\d+)[\d.]*[^\n]*Safari\// },
];

const analyserNavigateur = (ua) => {
  for (const { nom, motif } of NAVIGATEURS) {
    const m = motif.exec(ua);
    if (m) return `${nom} ${m[1]}`;
  }
  return 'Inconnu';
};

const analyserSysteme = (ua) => {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return 'Inconnu';
};

const analyserAppareil = (ua) => {
  if (/iPad|Tablet/.test(ua)) return 'Tablette';
  if (/Mobi|iPhone|Android/.test(ua)) return 'Mobile';
  if (/Windows NT|Macintosh|X11|CrOS/.test(ua)) return 'Ordinateur';
  return 'Inconnu';
};

/**
 * @param {string} ua en-tête User-Agent brut
 * @returns {{ navigateur: string, systeme: string, appareil: string }}
 */
const analyserUserAgent = (ua) => {
  const brut = String(ua || '');
  if (!brut) return { navigateur: 'Inconnu', systeme: 'Inconnu', appareil: 'Inconnu' };
  return {
    navigateur: analyserNavigateur(brut),
    systeme: analyserSysteme(brut),
    appareil: analyserAppareil(brut),
  };
};

module.exports = { analyserUserAgent };

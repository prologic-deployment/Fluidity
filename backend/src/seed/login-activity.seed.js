const { LoginActivity } = require('../models/login-activity.model');

/**
 * Activité de connexion de démonstration (réelle, stockée en base) pour les
 * comptes internes ET les accès portail client.
 */
const seedLoginActivity = async (ctx = {}) => {
  const { users = {}, clients = {} } = ctx;
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

  const samples = [];

  const userEmails = ['admin@fluidity.dev', 'support@fluidity.dev'];
  for (const email of userEmails) {
    const u = users[email];
    if (!u) continue;
    samples.push({
      principalType: 'UTILISATEUR', userId: u._id, date: hoursAgo(2), succes: true, mfaUtilise: false,
      ip: '203.0.113.10', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
      navigateur: 'Chrome', systeme: 'Windows', appareil: 'Ordinateur',
      sessionIat: Math.floor(Date.now() / 1000) - 7200,
    });
    samples.push({
      principalType: 'UTILISATEUR', userId: u._id, date: hoursAgo(26), succes: false,
      raisonEchec: 'MOT_DE_PASSE_INVALIDE', ip: '198.51.100.22',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      navigateur: 'Safari', systeme: 'iOS', appareil: 'Mobile',
    });
  }

  // Accès portail client
  for (const email of ['client@fluidity.dev', 'client2@fluidity.dev']) {
    const c = clients[email];
    if (!c) continue;
    samples.push({
      principalType: 'CLIENT', userId: c._id, date: hoursAgo(5), succes: true, mfaUtilise: false,
      ip: '192.0.2.40', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Firefox/128.0',
      navigateur: 'Firefox', systeme: 'macOS', appareil: 'Ordinateur',
      sessionIat: Math.floor(Date.now() / 1000) - 18000,
    });
  }

  let created = 0;
  for (const s of samples) {
    const exists = await LoginActivity.findOne({
      userId: s.userId,
      principalType: s.principalType,
      succes: s.succes,
      date: s.date,
    });
    if (exists) continue;
    await LoginActivity.create(s);
    created += 1;
  }
  console.log(`[Seed] Activité de connexion : ${created} événement(s) ajouté(s).`);
};

module.exports = { seedLoginActivity };

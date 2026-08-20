const { LoginActivity } = require('../models/login-activity.model');

/**
 * Activité de connexion de démonstration (réelle, stockée en base).
 */
const seedLoginActivity = async (ctx = {}) => {
  const { users = {} } = ctx;
  const targetEmails = ['admin@fluidity.dev', 'support@fluidity.dev', 'client@fluidity.dev'];
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

  const samples = [];
  for (const email of targetEmails) {
    const u = users[email];
    if (!u) continue;
    samples.push({
      principalType: 'UTILISATEUR',
      userId: u._id,
      date: hoursAgo(2),
      succes: true,
      mfaUtilise: false,
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
      navigateur: 'Chrome',
      systeme: 'Windows',
      appareil: 'Ordinateur',
      sessionIat: Math.floor(Date.now() / 1000) - 7200,
    });
    samples.push({
      principalType: 'UTILISATEUR',
      userId: u._id,
      date: hoursAgo(26),
      succes: false,
      raisonEchec: 'MOT_DE_PASSE_INVALIDE',
      ip: '198.51.100.22',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      navigateur: 'Safari',
      systeme: 'iOS',
      appareil: 'Mobile',
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

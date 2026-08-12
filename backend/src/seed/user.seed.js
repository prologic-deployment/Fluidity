const { Utilisateur } = require('../models/user.model');
const { encryptSecret } = require('../utils/crypto.util');

/** Mot de passe de développement (hashé par le hook pre-save). */
const DEMO_PASSWORD = 'Password123!';

/**
 * Comptes internes. Les accès portail vivent sur les fiches Client.
 * Rôles réels : PLATFORM_ADMIN | TENANT_ADMIN | MANAGER | AGENT | VIEWER
 * AGENT ≈ Support N1 / exploitation ; MANAGER ≈ Support N2 / validation.
 */
const seedUsers = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  const carthage = tenants['Carthage Digital'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — utilisateurs non créés.');
    return;
  }

  const demoUsers = [
    {
      tenantId: null,
      email: 'superadmin@servicedesk.dev',
      password: DEMO_PASSWORD,
      role: 'PLATFORM_ADMIN',
      department: 'Plateforme',
      firstName: 'Super',
      lastName: 'Admin',
    },
    {
      tenantId: null,
      email: 'admin@demo.local',
      password: DEMO_PASSWORD,
      role: 'PLATFORM_ADMIN',
      department: 'Plateforme',
      firstName: 'Admin',
      lastName: 'Demo',
    },

    // --- Fluidity (Tenant A) ---
    { tenantId: fluidity._id, email: 'admin@fluidity.dev', password: DEMO_PASSWORD, role: 'TENANT_ADMIN', department: 'Direction', firstName: 'Leila', lastName: 'Ben Ali' },
    { tenantId: fluidity._id, email: 'agent@fluidity.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Support N1', firstName: 'Sarah', lastName: 'Support' },
    { tenantId: fluidity._id, email: 'sarah.n1@fluidity.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Support N1', firstName: 'Sarah', lastName: 'Mansour' },
    { tenantId: fluidity._id, email: 'ahmed.reseau@fluidity.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Réseau', firstName: 'Ahmed', lastName: 'Network' },
    { tenantId: fluidity._id, email: 'karim.stockage@fluidity.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Stockage', firstName: 'Karim', lastName: 'Storage' },
    { tenantId: fluidity._id, email: 'manager@fluidity.dev', password: DEMO_PASSWORD, role: 'MANAGER', department: 'Technique', firstName: 'Nour', lastName: 'Manager' },
    { tenantId: fluidity._id, email: 'lina.cloud@fluidity.dev', password: DEMO_PASSWORD, role: 'MANAGER', department: 'Cloud', firstName: 'Lina', lastName: 'Cloud' },
    { tenantId: fluidity._id, email: 'youssef.secu@fluidity.dev', password: DEMO_PASSWORD, role: 'MANAGER', department: 'Sécurité', firstName: 'Youssef', lastName: 'Security' },
    { tenantId: fluidity._id, email: 'viewer@fluidity.dev', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Finance', firstName: 'Omar', lastName: 'Viewer' },
    { tenantId: fluidity._id, email: 'amine.user@fluidity.dev', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Métier', firstName: 'Amine', lastName: 'Trabelsi' },
    { tenantId: fluidity._id, email: 'selma.ops@fluidity.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Système', firstName: 'Selma', lastName: 'Ops' },
    // 2FA : configuration commencée mais non activée (login mot de passe toujours possible)
    {
      tenantId: fluidity._id,
      email: '2fa.pending@fluidity.dev',
      password: DEMO_PASSWORD,
      role: 'VIEWER',
      department: 'Sécurité',
      firstName: 'Ines',
      lastName: 'Totp',
      twoFactorSetupPending: true,
    },

    // --- Nova Systems (Tenant B) ---
    { tenantId: nova._id, email: 'nova-admin@nova-systems.dev', password: DEMO_PASSWORD, role: 'TENANT_ADMIN', department: 'Direction', firstName: 'Hedi', lastName: 'Nova' },
    { tenantId: nova._id, email: 'agent@nova-systems.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Support N1', firstName: 'Ines', lastName: 'Helpdesk' },
    { tenantId: nova._id, email: 'manager@nova-systems.dev', password: DEMO_PASSWORD, role: 'MANAGER', department: 'Cloud', firstName: 'Sami', lastName: 'N2' },
    { tenantId: nova._id, email: 'viewer@nova-systems.dev', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Audit', firstName: 'Rania', lastName: 'Lecture' },
    { tenantId: nova._id, email: 'nabil.user@nova-systems.dev', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Métier', firstName: 'Nabil', lastName: 'User' },
    { tenantId: nova._id, email: 'dora.reseau@nova-systems.dev', password: DEMO_PASSWORD, role: 'AGENT', department: 'Réseau', firstName: 'Dora', lastName: 'Net' },
  ];

  if (carthage) {
    demoUsers.push(
      { tenantId: carthage._id, email: 'tenantadmin.c@carthage-demo.local', password: DEMO_PASSWORD, role: 'TENANT_ADMIN', department: 'Direction', firstName: 'Maya', lastName: 'Carthage' },
      { tenantId: carthage._id, email: 'n1@carthage-demo.local', password: DEMO_PASSWORD, role: 'AGENT', department: 'Support N1', firstName: 'Tarek', lastName: 'N1' },
      { tenantId: carthage._id, email: 'n2.systeme@carthage-demo.local', password: DEMO_PASSWORD, role: 'MANAGER', department: 'Système', firstName: 'Aya', lastName: 'Systeme' },
      { tenantId: carthage._id, email: 'user1@carthage-demo.local', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Métier', firstName: 'Bilel', lastName: 'User' },
      { tenantId: carthage._id, email: 'user2@carthage-demo.local', password: DEMO_PASSWORD, role: 'VIEWER', department: 'Métier', firstName: 'Cyrine', lastName: 'User' }
    );
  }

  let created = 0;
  let existing = 0;
  for (const u of demoUsers) {
    const found = await Utilisateur.findOne({ email: u.email });
    if (found) {
      existing += 1;
      continue;
    }
    await new Utilisateur({
      ...u,
      tenantId: u.tenantId || undefined,
      status: 'active',
      twoFactorEnabled: false,
      twoFactorVerified: false,
    }).save();
    created += 1;
  }

  console.log(`[Seed] Utilisateurs : ${created} créé(s), ${existing} déjà présent(s).`);
};

module.exports = { seedUsers, DEMO_PASSWORD };

const { Utilisateur } = require('../models/user.model');

/**
 * Utilisateurs de démonstration (multi-tenant SaaS).
 * Mots de passe par défaut (à changer en production) : Password123!
 *
 * - superadmin@servicedesk.dev : Super Admin plateforme (hors tenant)
 * - admin@fluidity.dev         : Tenant Admin de « Fluidity »
 * - agent / manager / client   : rôles métier du tenant « Fluidity »
 * - nova-admin / nova-client   : second tenant « Nova Systems » (isolation)
 */
const seedUsers = async (tenants = {}) => {
  const count = await Utilisateur.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} utilisateur(s) existant(s) — seed ignoré.`);
    return;
  }

  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — utilisateurs non créés.');
    return;
  }

  const demoUsers = [
    // Super Admin plateforme (aucun tenant)
    { tenantId: null, email: 'superadmin@servicedesk.dev', password: 'Password123!', role: 'PLATFORM_ADMIN', department: 'Plateforme' },
    // Tenant « Fluidity »
    { tenantId: fluidity._id, email: 'admin@fluidity.dev', password: 'Password123!', role: 'TENANT_ADMIN', department: 'Direction' },
    { tenantId: fluidity._id, email: 'agent@fluidity.dev', password: 'Password123!', role: 'AGENT', department: 'Support' },
    { tenantId: fluidity._id, email: 'manager@fluidity.dev', password: 'Password123!', role: 'MANAGER', department: 'Technique' },
    { tenantId: fluidity._id, email: 'client@fluidity.dev', password: 'Password123!', role: 'CLIENT', department: '' },
    // Tenant « Nova Systems » (isolation inter-tenants)
    { tenantId: nova._id, email: 'nova-admin@nova-systems.dev', password: 'Password123!', role: 'TENANT_ADMIN', department: 'Direction' },
    { tenantId: nova._id, email: 'client2@fluidity.dev', password: 'Password123!', role: 'CLIENT', department: '' },
  ];

  for (const u of demoUsers) {
    await new Utilisateur({ ...u, tenantId: u.tenantId || undefined, status: 'active' }).save();
  }

  console.log(`[Seed] ${demoUsers.length} utilisateurs de démonstration créés dans db.utilisateurs.`);
};

module.exports = { seedUsers };

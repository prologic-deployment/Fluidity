const { Utilisateur } = require('../models/user.model');

/**
 * Utilisateurs de démonstration (multi-tenant SaaS).
 * Mots de passe par défaut (à changer en production) : Password123!
 *
 * Chaque tenant dispose de TOUS les rôles métier pour tester l'intégralité
 * des workflows (création CLIENT -> traitement AGENT -> validation MANAGER ->
 * supervision TENANT_ADMIN) et de l'isolation inter-tenants :
 * - superadmin@servicedesk.dev  : Super Admin plateforme (hors tenant)
 * - TENANT_ADMIN / AGENT / MANAGER / CLIENT / VIEWER dans « Fluidity »
 *   et « Nova Systems » (2 comptes CLIENT par tenant : propriétaire / autrui)
 */
const seedUsers = async (tenants = {}) => {
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
    { tenantId: fluidity._id, email: 'client2@fluidity.dev', password: 'Password123!', role: 'CLIENT', department: '' },
    { tenantId: fluidity._id, email: 'viewer@fluidity.dev', password: 'Password123!', role: 'VIEWER', department: 'Finance' },
    // Tenant « Nova Systems » (isolation inter-tenants)
    { tenantId: nova._id, email: 'nova-admin@nova-systems.dev', password: 'Password123!', role: 'TENANT_ADMIN', department: 'Direction' },
    { tenantId: nova._id, email: 'agent@nova-systems.dev', password: 'Password123!', role: 'AGENT', department: 'Exploitation' },
    { tenantId: nova._id, email: 'manager@nova-systems.dev', password: 'Password123!', role: 'MANAGER', department: 'Technique' },
    { tenantId: nova._id, email: 'client@nova-systems.dev', password: 'Password123!', role: 'CLIENT', department: '' },
    { tenantId: nova._id, email: 'viewer@nova-systems.dev', password: 'Password123!', role: 'VIEWER', department: 'Audit' },
  ];

  // Additif et idempotent : chaque compte n'est créé que si son email est
  // absent — relancer le seed complète une base existante (ex. anciens
  // jeux moins fournis) sans jamais toucher aux comptes déjà présents.
  let created = 0;
  let existing = 0;
  for (const u of demoUsers) {
    const found = await Utilisateur.findOne({ email: u.email });
    if (found) {
      existing += 1;
      continue;
    }
    await new Utilisateur({ ...u, tenantId: u.tenantId || undefined, status: 'active' }).save();
    created += 1;
  }

  console.log(
    `[Seed] Utilisateurs de démonstration : ${created} créé(s), ${existing} déjà présent(s) dans db.utilisateurs.`
  );
};

module.exports = { seedUsers };

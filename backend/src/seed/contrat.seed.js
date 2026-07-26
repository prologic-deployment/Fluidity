const { Contrat } = require('../models/contrat.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Contrats de démonstration, liés aux clients de démo (voir client.seed.js).
 */
const buildDemoContrats = (fluidityId, northwindId) => [
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    reference: 'CTR-2026-001',
    intitule: 'Infogérance & Support Standard',
    typeContrat: 'Support',
    statut: 'Actif',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    description: "Contrat annuel de support et d'infogérance de l'infrastructure cloud.",
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    reference: 'CTR-2026-002',
    intitule: 'Hébergement Cloud Premium',
    typeContrat: 'Hébergement',
    statut: 'Actif',
    dateDebut: new Date('2026-02-15'),
    description: 'Hébergement dédié avec SLA renforcé.',
  },
  {
    tenantId: northwindId,
    clientId: 'client2@fluidity.dev',
    reference: 'CTR-2026-101',
    intitule: 'Support Sécurité & Conformité',
    typeContrat: 'Sécurité',
    statut: 'Actif',
    dateDebut: new Date('2026-03-01'),
    description: 'Audit et supervision sécurité continue (tenant isolé).',
  },
];

/**
 * Insère les contrats de démonstration UNIQUEMENT si la collection est
 * vide (idempotent). Nécessite que seedTenants() ait déjà été exécuté.
 */
const seedContrats = async () => {
  const count = await Contrat.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} contrat(s) existant(s) — seed ignoré.`);
    return;
  }

  const [fluidity, northwind] = await Promise.all([
    Tenant.findOne({ slug: 'fluidity' }),
    Tenant.findOne({ slug: 'northwind-digital' }),
  ]);
  if (!fluidity || !northwind) {
    console.warn('[Seed] Tenants de démonstration introuvables — seed contrats ignoré.');
    return;
  }

  const demoContrats = buildDemoContrats(fluidity._id, northwind._id);
  await Contrat.insertMany(demoContrats);
  console.log(`[Seed] ${demoContrats.length} contrats de démonstration créés dans db.contrats.`);
};

module.exports = { buildDemoContrats, seedContrats };

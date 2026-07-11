const { Contrat } = require('../models/contrat.model');

/**
 * Contrats de démonstration, liés aux clients de démo (voir user.seed.js).
 */
const demoContrats = [
  {
    tenantId: 'tenant-001',
    clientId: 'client@fluidity.dev',
    reference: 'CTR-2026-001',
    intitule: 'Infogérance & Support Standard',
    typeContrat: 'Support',
    statut: 'Actif',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    description: 'Contrat annuel de support et d\'infogérance de l\'infrastructure cloud.',
  },
  {
    tenantId: 'tenant-001',
    clientId: 'client@fluidity.dev',
    reference: 'CTR-2026-002',
    intitule: 'Hébergement Cloud Premium',
    typeContrat: 'Hébergement',
    statut: 'Actif',
    dateDebut: new Date('2026-02-15'),
    description: 'Hébergement dédié avec SLA renforcé.',
  },
  {
    tenantId: 'tenant-002',
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
 * vide (idempotent).
 */
const seedContrats = async () => {
  const count = await Contrat.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} contrat(s) existant(s) — seed ignoré.`);
    return;
  }

  await Contrat.insertMany(demoContrats);
  console.log(`[Seed] ${demoContrats.length} contrats de démonstration créés dans db.contrats.`);
};

module.exports = { demoContrats, seedContrats };

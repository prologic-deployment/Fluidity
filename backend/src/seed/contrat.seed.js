const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

/**
 * Contrats de démonstration, liés aux clients de démo par ObjectId.
 */
const seedContrats = async (tenants = {}) => {
  const count = await Contrat.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} contrat(s) existant(s) — seed ignoré.`);
    return;
  }

  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — contrats non créés.');
    return;
  }

  const atlas = await Client.findOne({ tenantId: fluidity._id, email: 'client@fluidity.dev' });
  const novaRetail = await Client.findOne({ tenantId: nova._id, email: 'client2@fluidity.dev' });

  const demoContrats = [
    {
      tenantId: fluidity._id,
      clientId: atlas?._id,
      reference: 'CTR-2026-001',
      intitule: 'Infogérance & Support Standard',
      typeContrat: 'Support',
      statut: 'Actif',
      dateDebut: new Date('2026-01-01'),
      dateFin: new Date('2026-12-31'),
      description: "Contrat annuel de support et d'infogérance de l'infrastructure cloud.",
    },
    {
      tenantId: fluidity._id,
      clientId: atlas?._id,
      reference: 'CTR-2026-002',
      intitule: 'Hébergement Cloud Premium',
      typeContrat: 'Hébergement',
      statut: 'Actif',
      dateDebut: new Date('2026-02-15'),
      description: 'Hébergement dédié avec SLA renforcé.',
    },
    {
      tenantId: nova._id,
      clientId: novaRetail?._id,
      reference: 'CTR-2026-101',
      intitule: 'Support Sécurité & Conformité',
      typeContrat: 'Sécurité',
      statut: 'Actif',
      dateDebut: new Date('2026-03-01'),
      description: 'Audit et supervision sécurité continue (tenant isolé).',
    },
  ].filter((c) => c.clientId);

  await Contrat.insertMany(demoContrats);
  console.log(`[Seed] ${demoContrats.length} contrats de démonstration créés dans db.contrats.`);
};

module.exports = { seedContrats };

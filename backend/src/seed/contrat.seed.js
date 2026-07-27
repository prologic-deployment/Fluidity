const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

/**
 * Contrats de démonstration, liés aux clients de démo par ObjectId.
 */
const seedContrats = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — contrats non créés.');
    return;
  }

  const atlas = await Client.findOne({ tenantId: fluidity._id, email: 'client@fluidity.dev' });
  const helios = await Client.findOne({ tenantId: fluidity._id, email: 'client2@fluidity.dev' });
  const novaRetail = await Client.findOne({ tenantId: nova._id, email: 'client@nova-systems.dev' });

  // Types et statuts variés pour tester filtres et listes (Actif/Expiré/Suspendu)
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
      tenantId: fluidity._id,
      clientId: atlas?._id,
      reference: 'CTR-2025-009',
      intitule: 'Maintenance applicative legacy',
      typeContrat: 'Développement',
      statut: 'Expiré',
      dateDebut: new Date('2025-01-01'),
      dateFin: new Date('2025-12-31'),
      description: 'Ancien contrat de maintenance, conservé pour historique.',
    },
    {
      tenantId: fluidity._id,
      clientId: helios?._id,
      reference: 'CTR-2026-020',
      intitule: 'Sécurité SOC 24/7',
      typeContrat: 'Sécurité',
      statut: 'Actif',
      dateDebut: new Date('2026-04-01'),
      dateFin: new Date('2027-03-31'),
      description: 'Supervision sécurité continue et réponse à incidents.',
    },
    {
      tenantId: fluidity._id,
      clientId: helios?._id,
      reference: 'CTR-2026-021',
      intitule: 'Support N1 externalisé',
      typeContrat: 'Support',
      statut: 'Suspendu',
      dateDebut: new Date('2026-05-01'),
      description: 'Contrat suspendu en attente de renégociation.',
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
    {
      tenantId: nova._id,
      clientId: novaRetail?._id,
      reference: 'CTR-2025-050',
      intitule: 'Hébergement mutualisé',
      typeContrat: 'Hébergement',
      statut: 'Expiré',
      dateDebut: new Date('2025-06-01'),
      dateFin: new Date('2026-05-31'),
      description: 'Ancien hébergement mutualisé, remplacé par le contrat sécurité.',
    },
  ].filter((c) => c.clientId);

  // Additif et idempotent : chaque contrat n'est créé que si sa référence
  // est absente du tenant (index unique (tenantId, reference)).
  let created = 0;
  let existing = 0;
  for (const c of demoContrats) {
    const found = await Contrat.findOne({ tenantId: c.tenantId, reference: c.reference });
    if (found) {
      existing += 1;
      continue;
    }
    await Contrat.create(c);
    created += 1;
  }
  console.log(
    `[Seed] Contrats de démonstration : ${created} créé(s), ${existing} déjà présent(s) dans db.contrats.`
  );
};

module.exports = { seedContrats };

const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

const seedContrats = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  const carthage = tenants['Carthage Digital'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — contrats non créés.');
    return;
  }

  const [atlas, helios, maghreb, novaRetail, novaLog, carthageRetail, carthageMedia] = await Promise.all([
    Client.findOne({ tenantId: fluidity._id, email: 'client@fluidity.dev' }),
    Client.findOne({ tenantId: fluidity._id, email: 'client2@fluidity.dev' }),
    Client.findOne({ tenantId: fluidity._id, email: 'maghreb@fluidity.dev' }),
    Client.findOne({ tenantId: nova._id, email: 'client@nova-systems.dev' }),
    Client.findOne({ tenantId: nova._id, email: 'logistique@nova-systems.dev' }),
    carthage ? Client.findOne({ tenantId: carthage._id, email: 'retail@carthage-demo.local' }) : null,
    carthage ? Client.findOne({ tenantId: carthage._id, email: 'media@carthage-demo.local' }) : null,
  ]);

  const demoContrats = [
    { tenantId: fluidity._id, clientId: atlas?._id, reference: 'CTR-2026-001', intitule: 'Infogérance & Support Standard', typeContrat: 'Support', statut: 'Actif', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), description: "Support et infogérance de l'infrastructure cloud." },
    { tenantId: fluidity._id, clientId: atlas?._id, reference: 'CTR-2026-002', intitule: 'Hébergement Cloud Premium', typeContrat: 'Hébergement', statut: 'Actif', dateDebut: new Date('2026-02-15'), description: 'Hébergement dédié avec SLA renforcé.' },
    { tenantId: fluidity._id, clientId: atlas?._id, reference: 'CTR-2025-009', intitule: 'Maintenance applicative legacy', typeContrat: 'Développement', statut: 'Expiré', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31'), description: 'Ancien contrat de maintenance.' },
    { tenantId: fluidity._id, clientId: helios?._id, reference: 'CTR-2026-020', intitule: 'Sécurité SOC 24/7', typeContrat: 'Sécurité', statut: 'Actif', dateDebut: new Date('2026-04-01'), dateFin: new Date('2027-03-31'), description: 'Supervision sécurité et réponse à incidents.' },
    { tenantId: fluidity._id, clientId: helios?._id, reference: 'CTR-2026-021', intitule: 'Support N1 externalisé', typeContrat: 'Support', statut: 'Suspendu', dateDebut: new Date('2026-05-01'), description: 'Suspendu en attente de renégociation.' },
    { tenantId: fluidity._id, clientId: maghreb?._id, reference: 'CTR-2026-030', intitule: 'Infogérance Maghreb', typeContrat: 'Infogérance', statut: 'Actif', dateDebut: new Date('2026-03-01'), dateFin: new Date('2027-02-28'), description: 'Infogérance serveurs et stockage.' },
    { tenantId: nova._id, clientId: novaRetail?._id, reference: 'CTR-2026-101', intitule: 'Support Sécurité & Conformité', typeContrat: 'Sécurité', statut: 'Actif', dateDebut: new Date('2026-03-01'), description: 'Audit et supervision sécurité.' },
    { tenantId: nova._id, clientId: novaRetail?._id, reference: 'CTR-2025-050', intitule: 'Hébergement mutualisé', typeContrat: 'Hébergement', statut: 'Expiré', dateDebut: new Date('2025-06-01'), dateFin: new Date('2026-05-31'), description: 'Ancien hébergement mutualisé.' },
    { tenantId: nova._id, clientId: novaLog?._id, reference: 'CTR-2026-110', intitule: 'Support logistique', typeContrat: 'Support', statut: 'Actif', dateDebut: new Date('2026-01-15'), description: 'Support des entrepôts et WMS.' },
  ];

  if (carthage && carthageRetail) {
    demoContrats.push({
      tenantId: carthage._id, clientId: carthageRetail._id, reference: 'CTR-2026-201',
      intitule: 'Support retail Carthage', typeContrat: 'Support', statut: 'Actif',
      dateDebut: new Date('2026-06-01'), description: 'Support caisses et réseau magasins.',
    });
  }
  if (carthage && carthageMedia) {
    demoContrats.push({
      tenantId: carthage._id, clientId: carthageMedia._id, reference: 'CTR-2026-202',
      intitule: 'Hébergement média', typeContrat: 'Hébergement', statut: 'Actif',
      dateDebut: new Date('2026-07-01'), description: 'Hébergement CDN et origin.',
    });
  }

  let created = 0;
  let existing = 0;
  for (const c of demoContrats.filter((x) => x.clientId)) {
    const found = await Contrat.findOne({ tenantId: c.tenantId, reference: c.reference });
    if (found) {
      existing += 1;
      continue;
    }
    await Contrat.create(c);
    created += 1;
  }
  console.log(`[Seed] Contrats : ${created} créé(s), ${existing} déjà présent(s).`);
};

module.exports = { seedContrats };

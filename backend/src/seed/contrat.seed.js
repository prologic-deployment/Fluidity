const { Contrat } = require('../models/contrat.model');

/**
 * Contrats de démonstration, liés aux clients de démo par ObjectId.
 */
const demoContrats = [
  {
    clientEmail: 'client@fluidity.dev',
    reference: 'CTR-2026-001',
    intitule: 'Infogérance & Support Standard',
    typeContrat: 'Support',
    statut: 'Actif',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    description: "Contrat annuel de support et d'infogérance de l'infrastructure cloud.",
  },
  {
    clientEmail: 'client@fluidity.dev',
    reference: 'CTR-2026-002',
    intitule: 'Hébergement Cloud Premium',
    typeContrat: 'Hébergement',
    statut: 'Actif',
    dateDebut: new Date('2026-02-15'),
    description: 'Hébergement dédié avec SLA renforcé.',
  },
  {
    clientEmail: 'client2@fluidity.dev',
    reference: 'CTR-2026-101',
    intitule: 'Support Sécurité & Conformité',
    typeContrat: 'Sécurité',
    statut: 'Actif',
    dateDebut: new Date('2026-03-01'),
    description: 'Audit et supervision sécurité continue.',
  },
];

/**
 * Insère les contrats de démonstration (idempotent).
 * @param {Record<string, object>} clients map email → client
 * @returns {Promise<Record<string, object>>} map reference → contrat
 */
const seedContrats = async (clients = {}) => {
  const map = {};
  let created = 0;
  for (const c of demoContrats) {
    let contrat = await Contrat.findOne({ reference: c.reference });
    if (!contrat) {
      const { clientEmail, ...data } = c;
      contrat = await Contrat.create({ ...data, clientId: clients[clientEmail]._id });
      created += 1;
    }
    map[c.reference] = contrat;
  }
  console.log(
    created > 0
      ? `[Seed] Contrats : ${created} créé(s).`
      : '[Seed] Contrats de démonstration déjà présents.'
  );
  return map;
};

module.exports = { demoContrats, seedContrats };

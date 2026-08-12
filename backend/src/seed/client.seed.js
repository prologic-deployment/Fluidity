const { Client } = require('../models/client.model');
const { migrerComptesClients } = require('../utils/client-account-migration.util');
const { DEMO_PASSWORD } = require('./user.seed');

const seedClients = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  const carthage = tenants['Carthage Digital'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — clients non créés.');
    return;
  }

  const demoClients = [
    { tenantId: fluidity._id, email: 'client@fluidity.dev', nom: 'Atlas Industries', telephone: '+216 71 000 111', adresse: 'Tunis, Tunisie', statut: 'Actif' },
    { tenantId: fluidity._id, email: 'client2@fluidity.dev', nom: 'Helios Distribution', telephone: '+216 71 444 555', adresse: 'Ariana, Tunisie', statut: 'Actif' },
    { tenantId: fluidity._id, email: 'maghreb@fluidity.dev', nom: 'Maghreb Systems', telephone: '+216 71 888 000', adresse: 'Sousse, Tunisie', statut: 'Actif' },
    { tenantId: nova._id, email: 'client@nova-systems.dev', nom: 'Nova Retail', telephone: '+216 71 222 333', adresse: 'Sfax, Tunisie', statut: 'Actif' },
    { tenantId: nova._id, email: 'logistique@nova-systems.dev', nom: 'Nova Logistique', telephone: '+216 74 111 222', adresse: 'Gabès, Tunisie', statut: 'Actif' },
  ];

  if (carthage) {
    demoClients.push(
      { tenantId: carthage._id, email: 'retail@carthage-demo.local', nom: 'Carthage Retail', telephone: '+216 71 333 111', adresse: 'Lac 2, Tunis', statut: 'Actif' },
      { tenantId: carthage._id, email: 'media@carthage-demo.local', nom: 'Carthage Media', telephone: '+216 71 333 222', adresse: 'Berges du Lac', statut: 'Actif' }
    );
  }

  let created = 0;
  let existing = 0;
  let accesAjoutes = 0;
  for (const c of demoClients) {
    const found = await Client.findOne({ tenantId: c.tenantId, email: c.email }).select('+password');
    if (found) {
      existing += 1;
      if (!found.password) {
        found.password = DEMO_PASSWORD;
        found.mustChangePassword = false;
        await found.save();
        accesAjoutes += 1;
      }
      continue;
    }
    await Client.create({ ...c, password: DEMO_PASSWORD, mustChangePassword: false });
    created += 1;
  }
  console.log(
    `[Seed] Clients : ${created} créé(s), ${existing} déjà présent(s), ${accesAjoutes} accès portail ajouté(s).`
  );

  const conv = await migrerComptesClients();
  if (conv.convertis > 0) {
    console.log(
      `[Seed] ${conv.convertis} compte(s) CLIENT hérité(s) converti(s) (${conv.fichesCreees} fiche(s), ${conv.dossiersReassignes} dossier(s)).`
    );
  }
};

module.exports = { seedClients };

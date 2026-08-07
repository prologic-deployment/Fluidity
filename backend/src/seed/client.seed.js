const { Client } = require('../models/client.model');
const { migrerComptesClients } = require('../utils/client-account-migration.util');

/** Mot de passe de DÉMONSTRATION des accès portail (jamais en production). */
const MOT_DE_PASSE_DEMO = 'Password123!';

/**
 * Clients de démonstration, rattachés à LEUR tenant (ObjectId).
 * La fiche Client EST l'identité de l'accès portail (email + mot de passe)
 * — il n'y a plus de compte « Utilisateur role=CLIENT ». Les instances
 * disposant encore de ces anciens comptes sont converties à la volée
 * (transplant du hash, idempotent).
 */
const seedClients = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — clients non créés.');
    return;
  }

  const demoClients = [
    {
      tenantId: fluidity._id,
      email: 'client@fluidity.dev',
      nom: 'Atlas Industries',
      telephone: '+216 71 000 111',
      adresse: 'Tunis, Tunisie',
      statut: 'Actif',
    },
    {
      tenantId: fluidity._id,
      email: 'client2@fluidity.dev',
      nom: 'Helios Distribution',
      telephone: '+216 71 444 555',
      adresse: 'Ariana, Tunisie',
      statut: 'Actif',
    },
    {
      tenantId: nova._id,
      email: 'client@nova-systems.dev',
      nom: 'Nova Retail',
      telephone: '+216 71 222 333',
      adresse: 'Sfax, Tunisie',
      statut: 'Actif',
    },
  ];

  // Additif et idempotent : chaque fiche n'est créée que si l'email est
  // absent du tenant (index unique (tenantId, email)) ; une fiche existante
  // sans accès reçoit l'identité de démo (jamais d'écrasement d'un accès).
  let created = 0;
  let existing = 0;
  let accesAjoutes = 0;
  for (const c of demoClients) {
    const found = await Client.findOne({ tenantId: c.tenantId, email: c.email }).select('+password');
    if (found) {
      existing += 1;
      if (!found.password) {
        found.password = MOT_DE_PASSE_DEMO; // hashé via le hook pre-save
        found.mustChangePassword = false; // démo : connexion directe documentée
        await found.save();
        accesAjoutes += 1;
      }
      continue;
    }
    await Client.create({ ...c, password: MOT_DE_PASSE_DEMO, mustChangePassword: false });
    created += 1;
  }
  console.log(
    `[Seed] Clients de démonstration : ${created} créé(s), ${existing} déjà présent(s), ` +
      `${accesAjoutes} accès portail de démo ajouté(s) (db.clients).`
  );

  // Conversion des anciens comptes « Utilisateur role=CLIENT » encore
  // présents (instances antérieures à la refonte) — hash transplanté,
  // dossiers réassignés, idempotent.
  const conv = await migrerComptesClients();
  if (conv.convertis > 0) {
    console.log(
      `[Seed] ${conv.convertis} compte(s) CLIENT hérité(s) converti(s) en accès portail ` +
        `(${conv.fichesCreees} fiche(s) créée(s), ${conv.dossiersReassignes} dossier(s) réassigné(s)).`
    );
  }
};

module.exports = { seedClients };

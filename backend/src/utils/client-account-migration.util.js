const mongoose = require('mongoose');
const { Client } = require('../models/client.model');
const { LEGACY_ROLE_CLIENT } = require('../models/user.model');

/**
 * Migration d'architecture : les anciens comptes « Utilisateur role=CLIENT »
 * deviennent l'identité d'accès portail de leur fiche Client (refonte —
 * un client n'est plus un utilisateur interne).
 *
 * Pour chaque compte historique (rôle exact 'CLIENT' — seul rôle de ce
 * sens, voir LEGACY_ROLE_CLIENT) :
 *   1. sa fiche Client est résolue PAR EMAIL dans le tenant — upsert sur la
 *      clé naturelle (aucune fiche créée en double, aucune donnée perdue) ;
 *   2. son hash de mot de passe EXISTANT est transplanté TEL QUEL dans la
 *      fiche (connexion conservée, aucun reset forcé — écriture directe en
 *      collection pour ne PAS re-hasher via le hook pre-save) ;
 *   3. ses dossiers (demandes + changements) sont réassignés à la fiche
 *      (requester -> Client, requesterModel -> 'Client') ;
 *   4. son journal de connexion est rattaché au nouveau principal
 *      (principalType -> 'CLIENT') ;
 *   5. le compte interne est supprimé (plus aucun Utilisateur 'CLIENT').
 *
 * IDEMPOTENT : un compte déjà converti n'existe plus ; une fiche déjà
 * dotée d'un mot de passe n'est pas écrasée. Relançable sans risque ;
 * utilisée par `npm run migrate` et le seed (données historiques de démo).
 */

/** Nom d'affichage de secours pour une fiche créée de toutes pièces. */
const nomDeSecours = (compte) => {
  const identite = [compte.firstName, compte.lastName].filter(Boolean).join(' ').trim();
  return identite || compte.email.split('@')[0];
};

/**
 * Convertit tous les comptes CLIENT hérités en identités de fiches Client.
 * @returns {Promise<{ convertis: number, fichesCreees: number, dossiersReassignes: number }>}
 */
const migrerComptesClients = async () => {
  const db = mongoose.connection.db;
  const utilisateurs = db.collection('utilisateurs');
  const legacy = await utilisateurs
    .find({ role: LEGACY_ROLE_CLIENT })
    .project({ tenantId: 1, email: 1, password: 1, firstName: 1, lastName: 1, createdAt: 1 })
    .toArray();

  let convertis = 0;
  let fichesCreees = 0;
  let dossiersReassignes = 0;

  for (const compte of legacy) {
    // Données incohérentes (email/tenant absents) : document conservé tel
    // quel pour investigation — jamais de suppression silencieuse.
    if (!compte.email || !compte.tenantId) continue;

    // 1+2. Fiche du tenant (clé naturelle) + transplant du hash existant.
    const r = await Client.collection.updateOne(
      { tenantId: compte.tenantId, email: compte.email },
      {
        $set: {
          mustChangePassword: false, // le mot de passe a déjà été choisi par l'utilisateur
          ...(compte.password ? { password: compte.password } : {}),
        },
        $setOnInsert: {
          tenantId: compte.tenantId,
          email: compte.email,
          nom: nomDeSecours(compte),
          statut: 'Actif',
          notes: 'Fiche créée automatiquement lors de la conversion du compte portail (migration).',
          createdAt: compte.createdAt || new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    fichesCreees += r.upsertedCount || 0;
    const fiche = await Client.findOne({ tenantId: compte.tenantId, email: compte.email }).select('_id').lean();
    if (!fiche) continue; // ne devrait jamais arriver après un upsert réussi

    // 3. Réassignation des dossiers du principal
    for (const col of ['demandes', 'changements']) {
      const re = await db.collection(col).updateMany(
        { tenantId: compte.tenantId, requester: compte._id },
        { $set: { requester: fiche._id, requesterModel: 'Client' } }
      );
      dossiersReassignes += re.modifiedCount || 0;
    }

    // 4. Journal de connexion rattaché au nouveau principal
    await db.collection('loginactivities').updateMany(
      { principalType: 'UTILISATEUR', userId: compte._id },
      { $set: { principalType: 'CLIENT', userId: fiche._id } }
    );

    // 5. Suppression du compte interne converti
    await utilisateurs.deleteOne({ _id: compte._id });
    convertis += 1;
  }

  return { convertis, fichesCreees, dossiersReassignes };
};

module.exports = { migrerComptesClients };

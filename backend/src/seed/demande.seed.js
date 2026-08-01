const { Demande } = require('../models/demande.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Demandes de démonstration couvrant l'intégralité du cycle de vie
 * (§2.2.2) pour permettre de tester chaque transition de workflow avec
 * les comptes de démo (voir user.seed.js) sans avoir à en créer
 * manuellement :
 *
 *   Ouverte              -> à qualifier par support@fluidity.dev (SUPPORT_N1)
 *   En cours d'analyse   -> support@fluidity.dev peut la faire avancer
 *   En attente de validation -> à valider par responsable@fluidity.dev (RESPONSABLE_TECHNIQUE)
 *   En cours de réalisation  -> support@fluidity.dev peut la clore/réaliser
 *   En attente client    -> client@fluidity.dev (CLIENT) doit répondre
 *   Réalisée             -> client@fluidity.dev ou support@fluidity.dev peut la clôturer
 *   Clôturée / Rejetée / Annulé -> états finaux, pour vérifier l'historique
 *     et qu'aucune transition supplémentaire n'est proposée (voir workflow.js)
 */
const buildDemoDemandes = (fluidityId, northwindId) => [
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Création de 3 comptes développeurs',
    typeDemande: 'Création de compte',
    serviceEnvironnement: 'Production',
    categorie: 'VM',
    sousCategorie: 'Création VM',
    descriptionDetaillee: "Merci de créer 3 comptes développeurs avec accès à l'environnement de production.",
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-001',
    statut: 'Ouverte',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Ouverture de VLAN pour le nouveau bureau',
    typeDemande: "Modification d'accès",
    serviceEnvironnement: 'Production',
    categorie: 'Réseau',
    sousCategorie: 'VLAN',
    descriptionDetaillee: 'Le nouveau bureau de Sfax a besoin de son propre VLAN isolé, relié au siège via VPN.',
    prioriteSouhaitee: 'Élevée',
    contrat: 'CTR-2026-001',
    statut: "En cours d'analyse",
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: "Extension des accès IAM pour l'équipe sécurité",
    typeDemande: "Modification d'accès",
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'IAM',
    descriptionDetaillee: "L'équipe sécurité a besoin d'un accès élargi à la console IAM pour l'audit trimestriel.",
    prioriteSouhaitee: 'Urgente',
    contrat: 'CTR-2026-001',
    statut: 'En attente de validation',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Migration de la base clients vers PostgreSQL 16',
    typeDemande: 'Extension de ressources',
    serviceEnvironnement: 'Pré-production',
    categorie: 'Base de données',
    sousCategorie: 'PostgreSQL',
    descriptionDetaillee: 'Migration de la base "clients" (PostgreSQL 14) vers la version 16 en pré-production, avant bascule en prod.',
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-002',
    statut: 'En cours de réalisation',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Extension du quota de stockage NAS',
    typeDemande: 'Extension de ressources',
    serviceEnvironnement: 'Production',
    categorie: 'Stockage',
    sousCategorie: 'Quotas',
    descriptionDetaillee: 'Le quota NAS actuel (2 To) est presque atteint. Merci de préciser la volumétrie exacte souhaitée avant traitement.',
    prioriteSouhaitee: 'Élevée',
    contrat: 'CTR-2026-002',
    statut: 'En attente client',
    informationsComplementaires: 'En attente de la volumétrie cible de la part du client.',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Mise en place de la sauvegarde Veeam hebdomadaire',
    typeDemande: 'Support technique',
    serviceEnvironnement: 'Production',
    categorie: 'Sauvegarde',
    sousCategorie: 'Veeam',
    descriptionDetaillee: 'Configuration de sauvegardes Veeam hebdomadaires sur les serveurs de production, rétention 30 jours.',
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-001',
    statut: 'Réalisée',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: "Ajout d'un onduleur en salle serveur",
    typeDemande: 'Support technique',
    serviceEnvironnement: 'Production',
    categorie: 'Infrastructure',
    sousCategorie: 'Alimentation',
    descriptionDetaillee: "Installation d'un onduleur supplémentaire pour sécuriser l'alimentation de la baie serveur B2.",
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-001',
    statut: 'Clôturée',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: "Ouverture d'un accès administrateur permanent",
    typeDemande: "Modification d'accès",
    serviceEnvironnement: 'Production',
    categorie: 'Portail web',
    sousCategorie: 'API',
    descriptionDetaillee: "Demande d'accès administrateur permanent au portail web, hors procédure d'habilitation standard.",
    prioriteSouhaitee: 'Urgente',
    contrat: 'CTR-2026-002',
    statut: 'Rejetée',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objet: 'Déploiement du registre de conteneurs interne',
    typeDemande: 'Extension de ressources',
    serviceEnvironnement: 'Développement',
    categorie: 'Conteneurs',
    sousCategorie: 'Registry',
    descriptionDetaillee: "Mise en place d'un registre Docker interne pour l'équipe de développement — finalement annulée, solution SaaS retenue à la place.",
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-002',
    statut: 'Annulé',
  },
  // Tenant "Northwind Digital" — pour vérifier l'isolation des données entre tenants
  {
    tenantId: northwindId,
    clientId: 'client2@fluidity.dev',
    objet: "Audit de conformité sécurité annuel",
    typeDemande: "Demande d'information",
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Audit',
    descriptionDetaillee: "Lancement de l'audit de conformité sécurité annuel, périmètre complet.",
    prioriteSouhaitee: 'Élevée',
    contrat: 'CTR-2026-101',
    statut: 'Ouverte',
  },
  {
    tenantId: northwindId,
    clientId: 'client2@fluidity.dev',
    objet: 'Renouvellement des certificats SSL',
    typeDemande: 'Support technique',
    serviceEnvironnement: 'Production',
    categorie: 'Portail web',
    sousCategorie: 'Certificat SSL',
    descriptionDetaillee: 'Renouvellement des certificats SSL arrivant à expiration le mois prochain.',
    prioriteSouhaitee: 'Standard',
    contrat: 'CTR-2026-101',
    statut: 'Clôturée',
  },
];

/**
 * Insère les demandes de démonstration UNIQUEMENT si la collection est
 * vide (idempotent). Nécessite que seedTenants() ait déjà été exécuté.
 */
const seedDemandes = async () => {
  const count = await Demande.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} demande(s) existante(s) — seed ignoré.`);
    return;
  }

  const [fluidity, northwind] = await Promise.all([
    Tenant.findOne({ slug: 'fluidity' }),
    Tenant.findOne({ slug: 'northwind-digital' }),
  ]);
  if (!fluidity || !northwind) {
    console.warn('[Seed] Tenants de démonstration introuvables — seed demandes ignoré.');
    return;
  }

  const demoDemandes = buildDemoDemandes(fluidity._id, northwind._id);
  await Demande.insertMany(demoDemandes);
  console.log(`[Seed] ${demoDemandes.length} demandes de démonstration créées dans db.demandes (tout le cycle de vie couvert).`);
};

module.exports = { buildDemoDemandes, seedDemandes };

const { Changement } = require('../models/changement.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Changements de démonstration couvrant l'intégralité du cycle de vie
 * (§2.3.4) pour permettre de tester chaque transition de workflow avec
 * les comptes de démo (voir user.seed.js) :
 *
 *   Soumis                       -> à évaluer par responsable@fluidity.dev (RESPONSABLE_TECHNIQUE)
 *   En attente de validation     -> à valider par responsable@fluidity.dev / commercial@fluidity.dev
 *   Approuvé                     -> à planifier par exploitation@fluidity.dev (EXPLOITATION)
 *   Planifié                     -> exploitation@fluidity.dev peut démarrer l'implémentation
 *   En cours d'implémentation    -> exploitation@fluidity.dev : Implémenté ou Rollback
 *   Implémenté                   -> à revoir par responsable@fluidity.dev
 *   En revue post-implémentation -> responsable@fluidity.dev peut clôturer
 *   Rollback / Clôturé / Rejeté / Annulé -> états finaux, pour vérifier l'historique
 *     et qu'aucune transition supplémentaire n'est proposée (voir workflow.js)
 */
const buildDemoChangements = (fluidityId, northwindId) => [
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Augmentation de la RAM du serveur DB-PROD-02',
    descriptionDetaillee: 'Passage de 32 Go à 64 Go de RAM sur le serveur de base de données principal, pour absorber la charge du dernier trimestre.',
    serviceEnvironnement: 'Production',
    categorie: 'VM',
    sousCategorie: 'Extension ressources',
    fenetreIntervention: new Date('2026-08-05T22:00:00'),
    planRetourArriere: "Restauration du snapshot pré-changement en cas d'échec, ramenant la RAM à 32 Go.",
    typeChangement: 'Normal',
    contrat: 'CTR-2026-001',
    statut: 'Soumis',
    specifications: {
      general: { ressourcesConcernees: 'DB-PROD-02', commentaire: 'Fenêtre hors heures de production.' },
      serveur: { os: 'Ubuntu 22.04', cpuCores: 8, ramGo: 64, disques: [{ tailleGo: 500, type: 'NVMe' }] },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Ouverture de la route inter-VLAN production/DMZ',
    descriptionDetaillee: "Ajout d'une règle de routage entre le VLAN production et la DMZ pour le nouveau service API public.",
    serviceEnvironnement: 'Production',
    categorie: 'Réseau',
    sousCategorie: 'Routeur',
    fenetreIntervention: new Date('2026-08-10T21:00:00'),
    planRetourArriere: 'Suppression de la règle de routage ajoutée, retour à la segmentation actuelle.',
    typeChangement: 'Majeur',
    contrat: 'CTR-2026-001',
    statut: 'En attente de validation',
    specifications: {
      general: { ressourcesConcernees: 'Routeur core-01' },
      reseau: { vlan: 'VLAN 100', adresseIp: '10.20.30.40', masqueSousReseau: '255.255.255.0', passerelle: '10.20.30.1' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Déploiement du cluster Kubernetes de staging',
    descriptionDetaillee: "Mise en place d'un cluster Kubernetes dédié à l'environnement de staging (3 nœuds).",
    serviceEnvironnement: 'Pré-production',
    categorie: 'Conteneurs',
    sousCategorie: 'Kubernetes',
    fenetreIntervention: new Date('2026-08-12T20:00:00'),
    planRetourArriere: 'Désinstallation du cluster et bascule des déploiements sur les VM existantes.',
    typeChangement: 'Majeur',
    contrat: 'CTR-2026-002',
    statut: 'Approuvé',
    specifications: {
      general: { ressourcesConcernees: 'Namespace staging' },
      conteneurs: { nomConteneur: 'api-staging', image: 'registry.fluidity.dev/api:2.4.0', registry: 'registry.fluidity.dev', namespace: 'staging' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Extension du quota GPU pour le pipeline IA',
    descriptionDetaillee: "Allocation de 2 GPU supplémentaires pour accélérer l'entraînement du modèle de scoring client.",
    serviceEnvironnement: 'Production',
    categorie: 'IA-GPU',
    sousCategorie: 'GPU Allocation',
    fenetreIntervention: new Date('2026-08-15T19:00:00'),
    planRetourArriere: "Retour à l'allocation GPU précédente (2 GPU) si dégradation observée.",
    typeChangement: 'Normal',
    contrat: 'CTR-2026-002',
    statut: 'Planifié',
    specifications: {
      general: { ressourcesConcernees: 'Cluster IA-01' },
      iaGpu: { modeleGpu: 'NVIDIA A100', versionCuda: '12.4', vramGo: 80, nombreGpu: 4 },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Migration du schéma de la base "facturation"',
    descriptionDetaillee: "Application de la migration de schéma v12 sur la base de données facturation (ajout de colonnes, aucune suppression).",
    serviceEnvironnement: 'Production',
    categorie: 'Base de données',
    sousCategorie: 'PostgreSQL',
    fenetreIntervention: new Date('2026-08-01T23:00:00'),
    planRetourArriere: 'Restauration du dump pré-migration (script fourni), durée estimée 20 minutes.',
    typeChangement: 'Majeur',
    contrat: 'CTR-2026-001',
    statut: "En cours d'implémentation",
    specifications: {
      general: { ressourcesConcernees: 'DB facturation' },
      database: { moteur: 'PostgreSQL', version: '16.2', instance: 'db-billing-01', nomBaseDeDonnees: 'facturation' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Extension du stockage NAS partagé',
    descriptionDetaillee: 'Extension du volume NAS partagé de 5 To supplémentaires pour les équipes data.',
    serviceEnvironnement: 'Production',
    categorie: 'Stockage',
    sousCategorie: 'NAS',
    fenetreIntervention: new Date('2026-07-20T22:00:00'),
    planRetourArriere: 'Retrait du volume additionnel si non-conformité détectée post-extension.',
    typeChangement: 'Normal',
    contrat: 'CTR-2026-002',
    statut: 'Implémenté',
    specifications: {
      general: { ressourcesConcernees: 'NAS-STORAGE-01' },
      stockage: { capaciteGo: 5000, pointMontage: '/mnt/data', systemeFichiers: 'NFS' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Durcissement des règles firewall périmétriques',
    descriptionDetaillee: 'Application des nouvelles règles firewall recommandées suite au dernier audit de sécurité.',
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Firewall',
    fenetreIntervention: new Date('2026-07-15T21:00:00'),
    planRetourArriere: 'Restauration de la configuration firewall précédente (sauvegardée avant intervention).',
    typeChangement: 'Majeur',
    contrat: 'CTR-2026-001',
    statut: 'En revue post-implémentation',
    specifications: {
      general: { ressourcesConcernees: 'Firewall périmétrique' },
      securite: { regleFirewall: 'Blocage entrant hors liste blanche', niveauSecurite: 'Élevé', certificat: 'N/A' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: "Mise à niveau de l'espace de sauvegarde",
    descriptionDetaillee: "Ajout d'espace de sauvegarde supplémentaire suite à l'échec de l'implémentation initiale (incompatibilité de version Veeam).",
    serviceEnvironnement: 'Production',
    categorie: 'Sauvegarde',
    sousCategorie: 'Backup',
    fenetreIntervention: new Date('2026-07-10T22:00:00'),
    planRetourArriere: "Rollback effectué : retour à l'espace de sauvegarde initial.",
    typeChangement: 'Normal',
    contrat: 'CTR-2026-002',
    statut: 'Rollback',
    specifications: {
      general: { ressourcesConcernees: 'Backup Veeam' },
      backup: { espaceBackupSupplementaireGo: 500, retentionSouhaitee: '6 Mois' },
    },
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: "Mise à jour de l'OS des serveurs web",
    descriptionDetaillee: 'Mise à jour vers Ubuntu 24.04 LTS sur les 3 serveurs web de production.',
    serviceEnvironnement: 'Production',
    categorie: 'Portail web',
    sousCategorie: 'Nginx',
    fenetreIntervention: new Date('2026-06-20T22:00:00'),
    planRetourArriere: 'Rollback vers Ubuntu 22.04 via snapshot, testé et validé.',
    typeChangement: 'Normal',
    contrat: 'CTR-2026-001',
    statut: 'Clôturé',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: 'Changement de fournisseur DNS',
    descriptionDetaillee: 'Migration complète du DNS vers un nouveau fournisseur — refusé, impact jugé trop risqué sans fenêtre de test suffisante.',
    serviceEnvironnement: 'Production',
    categorie: 'Réseau',
    sousCategorie: 'DNS',
    fenetreIntervention: new Date('2026-08-20T22:00:00'),
    planRetourArriere: "Conservation du fournisseur DNS actuel.",
    typeChangement: 'Majeur',
    contrat: 'CTR-2026-001',
    statut: 'Rejeté',
  },
  {
    tenantId: fluidityId,
    clientId: 'client@fluidity.dev',
    objetChangement: "Remplacement de l'antivirus du parc",
    descriptionDetaillee: "Déploiement d'une nouvelle solution antivirus sur l'ensemble du parc — finalement annulé, contrat non signé avec l'éditeur.",
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Antivirus',
    fenetreIntervention: new Date('2026-08-25T22:00:00'),
    planRetourArriere: 'Sans objet (changement annulé avant exécution).',
    typeChangement: 'Normal',
    contrat: 'CTR-2026-002',
    statut: 'Annulé',
  },
  // Tenant "Northwind Digital" — pour vérifier l'isolation des données entre tenants
  {
    tenantId: northwindId,
    clientId: 'client2@fluidity.dev',
    objetChangement: 'Renforcement du monitoring infrastructure',
    descriptionDetaillee: "Déploiement d'une sonde de monitoring supplémentaire sur les serveurs critiques.",
    serviceEnvironnement: 'Production',
    categorie: 'Infrastructure',
    sousCategorie: 'Monitoring',
    fenetreIntervention: new Date('2026-08-08T21:00:00'),
    planRetourArriere: 'Désinstallation de la sonde en cas de conflit détecté.',
    typeChangement: 'Normal',
    contrat: 'CTR-2026-101',
    statut: 'Soumis',
  },
  {
    tenantId: northwindId,
    clientId: 'client2@fluidity.dev',
    objetChangement: 'Renouvellement du certificat SSL wildcard',
    descriptionDetaillee: 'Renouvellement annuel du certificat SSL wildcard *.northwind-digital.dev.',
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Certificat',
    fenetreIntervention: new Date('2026-06-01T21:00:00'),
    planRetourArriere: 'Réactivation du certificat précédent, encore valide 48h.',
    typeChangement: 'Normal',
    contrat: 'CTR-2026-101',
    statut: 'Clôturé',
  },
];

/**
 * Insère les changements de démonstration UNIQUEMENT si la collection
 * est vide (idempotent). Nécessite que seedTenants() ait déjà été exécuté.
 */
const seedChangements = async () => {
  const count = await Changement.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} changement(s) existant(s) — seed ignoré.`);
    return;
  }

  const [fluidity, northwind] = await Promise.all([
    Tenant.findOne({ slug: 'fluidity' }),
    Tenant.findOne({ slug: 'northwind-digital' }),
  ]);
  if (!fluidity || !northwind) {
    console.warn('[Seed] Tenants de démonstration introuvables — seed changements ignoré.');
    return;
  }

  const demoChangements = buildDemoChangements(fluidity._id, northwind._id);
  await Changement.insertMany(demoChangements);
  console.log(`[Seed] ${demoChangements.length} changements de démonstration créés dans db.changements (tout le cycle de vie couvert).`);
};

module.exports = { buildDemoChangements, seedChangements };

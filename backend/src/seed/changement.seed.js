const { Changement } = require('../models/changement.model');
const { Utilisateur } = require('../models/user.model');
const { Contrat } = require('../models/contrat.model');

/**
 * Changements de démonstration couvrant TOUT LE WORKFLOW (§2.3.4/§2.3.5) :
 *   Soumis -> En attente de validation -> Approuvé -> Planifié
 *   -> En cours d'implémentation -> Implémenté -> En revue post-implémentation
 *   -> Clôturé   (+ Rollback, Rejeté, Annulé)
 *
 * Chaque section de spécifications est représentée (serveur/disques dynamiques,
 * réseau/IPv4, sauvegarde/rétention, base de données, stockage, portail web,
 * conteneurs, IA-GPU, sécurité) pour tester aussi le formulaire dynamique et
 * l'affichage du détail.
 *
 * Les statuts sont injectés directement (données de démo) — jamais en production.
 */
const seedChangements = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — changements non créés.');
    return;
  }

  const [atlas, helios, novaClient] = await Promise.all([
    Utilisateur.findOne({ email: 'client@fluidity.dev' }),
    Utilisateur.findOne({ email: 'client2@fluidity.dev' }),
    Utilisateur.findOne({ email: 'client@nova-systems.dev' }),
  ]);
  const [ctrAtlas, ctrAtlas2, ctrHelios, ctrNova] = await Promise.all([
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-001' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-002' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-020' }),
    Contrat.findOne({ tenantId: nova._id, reference: 'CTR-2026-101' }),
  ]);
  if (!atlas || !helios || !novaClient || !ctrAtlas || !ctrAtlas2 || !ctrHelios || !ctrNova) {
    console.warn('[Seed] Comptes/contrats de démonstration absents — changements non créés.');
    return;
  }

  const demoChangements = [
    // --- Statut : Soumis (action MANAGER : évaluation) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Soumis',
      objetChangement: 'Extension CPU/RAM de la VM e-commerce',
      descriptionDetaillee:
        'Passage de la VM shop-prod-01 de 4 vCPU / 16 Go à 8 vCPU / 32 Go pour absorber le trafic ' +
        'des soldes. Sanction de ressources validée sur le cluster.',
      serviceEnvironnement: 'Production', categorie: 'VM', sousCategorie: 'Extension ressources',
      fenetreIntervention: new Date('2026-07-31T21:00:00.000Z'),
      prerequisNecessaires: 'Snapshot préalable + validation du gel applicatif.',
      planRetourArriere: 'Retour au snapshot Veeam et redémarrage des services en cas d\'anomalie.',
      typeChangement: 'Standard', contrat: ctrAtlas._id,
      specifications: {
        general: { ressourcesConcernees: 'VM shop-prod-01 (cluster A)' },
        serveur: {
          os: 'Ubuntu 24.04', cpuCores: 8, ramGo: 32,
          disques: [
            { capaciteGo: 500, type: 'NVMe' },
            { capaciteGo: 1000, type: 'SAS' },
          ],
        },
      },
    },
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Soumis',
      objetChangement: 'Création du VLAN IoT entrepôt',
      descriptionDetaillee:
        'Création du VLAN 240 dédié aux équipements IoT de l\'entrepôt, isolé du LAN bureautique, ' +
        'avec DHCP géré et ACL inter-VLAN restrictives.',
      serviceEnvironnement: 'Pré-production', categorie: 'Réseau', sousCategorie: 'VLAN',
      fenetreIntervention: new Date('2026-08-02T18:00:00.000Z'),
      planRetourArriere: 'Suppression du VLAN 240 et retour à la configuration switch sauvegardée.',
      typeChangement: 'Majeur', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: 'Switchs entrepôt + pare-feu inter-VLAN' },
        reseau: { vlan: '240', adresseIp: '10.40.0.1', masqueSousReseau: '255.255.255.0', passerelle: '10.40.0.254' },
      },
    },
    // --- Statut : En attente de validation ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'En attente de validation',
      objetChangement: 'Durcissement des règles pare-feu périmétriques',
      descriptionDetaillee:
        'Fermeture des ports non utilisés exposés en DMZ et restriction SSH aux seules IP du ' +
        'bastion, conformément aux recommandations de l\'audit sécurité.',
      serviceEnvironnement: 'Production', categorie: 'Sécurité', sousCategorie: 'Firewall',
      fenetreIntervention: new Date('2026-08-01T22:30:00.000Z'),
      prerequisNecessaires: 'Export de la configuration actuelle + validation des flux métier.',
      planRetourArriere: 'Réimport de la configuration pare-feu exportée avant intervention.',
      typeChangement: 'Urgent', contrat: ctrAtlas._id,
      specifications: {
        general: { ressourcesConcernees: 'Pare-feu périmétrique HA (2 nœuds)' },
        securite: { perimetre: 'DMZ + bastion SSH', niveauCriticite: 'Critique' },
      },
    },
    // --- Statut : Approuvé (action AGENT : planification) ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Approuvé',
      objetChangement: 'Montée de version PostgreSQL 14 vers 16',
      descriptionDetaillee:
        'Migration de l\'instance PostgreSQL mutualisée de reporting vers la version 16 avec ' +
        'pg_upgrade, puis analyse des performances.',
      serviceEnvironnement: 'Pré-production', categorie: 'Base de données', sousCategorie: 'PostgreSQL',
      fenetreIntervention: new Date('2026-08-05T20:00:00.000Z'),
      prerequisNecessaires: 'Dump logique complet + arrêt des connecteurs BI.',
      planRetourArriere: 'Restauration du dump sur l\'instance d\'origine et reconfiguration BI.',
      typeChangement: 'Majeur', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: 'Instance PG reporting (pré-prod)' },
        baseDeDonnees: { moteur: 'PostgreSQL', version: '16', tailleGo: 120 },
      },
    },
    // --- Statut : Planifié (fenêtre fixée) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Planifié',
      objetChangement: 'Extension du volume NAS sauvegardes locales',
      descriptionDetaillee:
        'Ajout de 4 To sur le volume NAS dédié aux sauvegardes locales, avec mise à jour des quotas ' +
        'par département.',
      serviceEnvironnement: 'Production', categorie: 'Stockage', sousCategorie: 'Extension capacité',
      fenetreIntervention: new Date('2026-08-06T19:00:00.000Z'),
      planRetourArriere: 'Retour aux quotas initiaux : l\'extension elle-même est sans risque.',
      typeChangement: 'Standard', contrat: ctrAtlas._id,
      specifications: {
        general: { ressourcesConcernees: 'NAS local site Tunis' },
        stockage: { typeStockage: 'NAS', capaciteGo: 4096, protocole: 'SMB' },
      },
    },
    // --- Statut : En cours d'implémentation ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: "En cours d'implémentation",
      objetChangement: 'Migration des workloads Docker vers Kubernetes',
      descriptionDetaillee:
        'Bascule des 6 conteneurs applicatifs du serveur legacy vers le cluster K8s mutualisé ' +
        '(namespace dédié, registry privée, probes de santé).',
      serviceEnvironnement: 'Production', categorie: 'Conteneurs', sousCategorie: 'Kubernetes',
      fenetreIntervention: new Date('2026-07-27T20:00:00.000Z'),
      prerequisNecessaires: 'Images poussées dans la registry privée + secrets migrés.',
      planRetourArriere: 'Réactivation des services Docker legacy conservés à l\'arrêt à chaud.',
      typeChangement: 'Majeur', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: '6 services applicatifs legacy' },
        conteneurs: { plateforme: 'Kubernetes', nombreReplicas: 3, cpuAlloue: '500m', memoireAllouee: '1Gi' },
      },
    },
    // --- Statut : Rollback (implémentation échouée, retour arrière) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Rollback',
      objetChangement: 'Déploiement portail v3 (rollback appliqué)',
      descriptionDetaillee:
        'Le déploiement du portail clients v3 a provoqué des erreurs 500 sur le parcours de ' +
        'connexion. Le plan de retour arrière a été exécuté avec succès.',
      serviceEnvironnement: 'Production', categorie: 'Portail web', sousCategorie: 'Déploiement',
      fenetreIntervention: new Date('2026-07-20T21:00:00.000Z'),
      planRetourArriere: 'Réactivation de la version v2 (blue/green).',
      typeChangement: 'Urgent', contrat: ctrAtlas._id,
      specifications: {
        general: { ressourcesConcernees: 'Portail clients (front Nginx + API)' },
        portailWeb: { domaine: 'clients.atlas.tn', sslRequis: 'Oui', technologie: 'Nginx + Node.js' },
      },
    },
    // --- Statut : Implémenté (action MANAGER : revue post-implémentation) ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Implémenté',
      objetChangement: 'Allocation de 2 GPU pour l\'inférence IA',
      descriptionDetaillee:
        'Mise à disposition de 2 GPU partagés sur le nœud gpu-01 pour le service de recommandation ' +
        'logistique (drivers CUDA 12.4).',
      serviceEnvironnement: 'Développement', categorie: 'IA-GPU', sousCategorie: 'GPU Allocation',
      fenetreIntervention: new Date('2026-07-25T09:00:00.000Z'),
      planRetourArriere: 'Libération de l\'allocation GPU et arrêt du conteneur d\'inférence.',
      typeChangement: 'Standard', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: 'Nœud gpu-01 du cluster' },
        iaGpu: { typeGpu: 'NVIDIA A100', nombreGpu: 2, framework: 'PyTorch' },
      },
    },
    // --- Statut : En revue post-implémentation (MANAGER peut clôturer) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'En revue post-implémentation',
      objetChangement: 'Alignement de la rétention sauvegarde à 6 mois',
      descriptionDetaillee:
        'Passage de la politique de rétention Veeam de 3 à 6 mois pour les VM financières, avec ' +
        'extension de l\'espace de sauvegarde associé.',
      serviceEnvironnement: 'Production', categorie: 'Sauvegarde', sousCategorie: 'Retention',
      fenetreIntervention: new Date('2026-07-22T20:00:00.000Z'),
      planRetourArriere: 'Retour à la rétention initiale de 3 mois (purge des points excédentaires).',
      typeChangement: 'Majeur', contrat: ctrAtlas2._id,
      specifications: {
        general: { ressourcesConcernees: 'Job Veeam VM-finances' },
        backup: { espaceBackupSupplementaireGo: 2000, retentionSouhaitee: '6 Mois', licencesNecessaires: 'Veeam Enterprise+' },
      },
    },
    // --- Statut : Clôturé ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Clôturé',
      objetChangement: 'Création d\'une VM de développement isolée',
      descriptionDetaillee:
        'Provision d\'une VM de développement (4 vCPU / 16 Go / 100 Go NVMe) dans le VLAN de test ' +
        'pour l\'équipe mobile.',
      serviceEnvironnement: 'Développement', categorie: 'VM', sousCategorie: 'Création VM',
      fenetreIntervention: new Date('2026-07-10T14:00:00.000Z'),
      planRetourArriere: 'Suppression de la VM et libération de l\'adresse IP.',
      typeChangement: 'Standard', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: 'Cluster dev - hôte 2' },
        serveur: { os: 'Debian 12', cpuCores: 4, ramGo: 16, disques: [{ capaciteGo: 100, type: 'NVMe' }] },
      },
    },
    // --- Statut : Rejeté ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Rejeté',
      objetChangement: 'Ouverture DNS publique sur tous les sous-domaines',
      descriptionDetaillee:
        'Demande de wildcard DNS *.atlas-services.tn pointant vers l\'IP publique du frontal. ' +
        'Rejeté par le comité sécurité : exposition trop large, entrées nominatives requises.',
      serviceEnvironnement: 'Production', categorie: 'Réseau', sousCategorie: 'DNS',
      fenetreIntervention: new Date('2026-07-18T18:00:00.000Z'),
      planRetourArriere: 'Suppression de l\'entrée wildcard.',
      typeChangement: 'Majeur', contrat: ctrAtlas._id,
      specifications: {
        general: { ressourcesConcernees: 'Zone DNS atlas-services.tn' },
        reseau: { adresseIp: '203.0.113.10' },
      },
    },
    // --- Statut : Annulé (figé) ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Annulé',
      objetChangement: 'Suppression de la VM de démonstration commerciale',
      descriptionDetaillee:
        'Suppression de la VM demo-com-01 devenue inutile. Annulé par le client : la démonstration ' +
        'est reconduite pour un mois.',
      serviceEnvironnement: 'Test', categorie: 'VM', sousCategorie: 'Suppression VM',
      fenetreIntervention: new Date('2026-07-15T17:00:00.000Z'),
      planRetourArriere: 'Restauration du snapshot de la veille.',
      typeChangement: 'Standard', contrat: ctrHelios._id,
      specifications: {
        general: { ressourcesConcernees: 'VM demo-com-01' },
        serveur: { os: 'Windows Server 2025', cpuCores: 2, ramGo: 8, disques: [{ capaciteGo: 80, type: 'SSD' }] },
      },
    },

    // ================= Tenant « Nova Systems » (isolation) =================
    {
      tenantId: nova._id, requester: novaClient._id, statut: 'Soumis',
      objetChangement: 'Mise en place d\'un VPN site-à-site avec notre siège',
      descriptionDetaillee:
        'Établissement d\'un tunnel IPsec entre notre firewall de siège (Sfax) et le VPC hébergé, ' +
        'avec routage des sous-réseaux administratifs.',
      serviceEnvironnement: 'Production', categorie: 'Réseau', sousCategorie: 'VPN',
      fenetreIntervention: new Date('2026-08-03T21:00:00.000Z'),
      prerequisNecessaires: 'Clés pré-partagées échangées par canal sécurisé.',
      planRetourArriere: 'Suppression du tunnel et retour au routage initial.',
      typeChangement: 'Majeur', contrat: ctrNova._id,
      specifications: {
        general: { ressourcesConcernees: 'Passerelle VPN du tenant Nova' },
        reseau: { adresseIp: '10.60.0.1', masqueSousReseau: '255.255.255.252' },
      },
    },
    {
      tenantId: nova._id, requester: novaClient._id, statut: 'Planifié',
      objetChangement: 'Remplacement des sondes de supervision obsolètes',
      descriptionDetaillee:
        'Déploiement de nouvelles sondes de monitoring sur les hyperviseurs, avec bascule des ' +
        'alertes vers le nouveau tableau de bord.',
      serviceEnvironnement: 'Production', categorie: 'Infrastructure', sousCategorie: 'Monitoring',
      fenetreIntervention: new Date('2026-08-04T20:00:00.000Z'),
      planRetourArriere: 'Réactivation des anciennes sondes conservées en parallèle 7 jours.',
      typeChangement: 'Standard', contrat: ctrNova._id,
      specifications: {
        general: { ressourcesConcernees: 'Hyperviseurs du cluster Nova' },
      },
    },
    {
      tenantId: nova._id, requester: novaClient._id, statut: 'Clôturé',
      objetChangement: 'Extension de la rétention de sauvegarde à 12 mois',
      descriptionDetaillee:
        'Alignement de la politique de rétention des sauvegardes de l\'ERP sur les exigences ' +
        'légales de conservation comptable.',
      serviceEnvironnement: 'Production', categorie: 'Sauvegarde', sousCategorie: 'Backup configuration',
      fenetreIntervention: new Date('2026-06-28T22:00:00.000Z'),
      planRetourArriere: 'Retour à la rétention initiale.',
      typeChangement: 'Standard', contrat: ctrNova._id,
      specifications: {
        general: { ressourcesConcernees: 'Job de sauvegarde ERP Nova' },
        backup: { espaceBackupSupplementaireGo: 500, retentionSouhaitee: '12 Mois' },
      },
    },
  ];

  // Additif et idempotent PAR TENANT (même règle que les demandes).
  let created = 0;
  for (const tenant of [fluidity, nova]) {
    const existing = await Changement.countDocuments({ tenantId: tenant._id });
    if (existing > 0) continue;
    const docs = demoChangements.filter((c) => String(c.tenantId) === String(tenant._id));
    if (docs.length) {
      await Changement.insertMany(docs);
      created += docs.length;
    }
  }
  console.log(
    created > 0
      ? `[Seed] ${created} changements de démonstration créés dans db.changements (tous les statuts + toutes les sections de specs).`
      : '[Seed] Changements de démonstration déjà présents — aucun ajout.'
  );
};

module.exports = { seedChangements };

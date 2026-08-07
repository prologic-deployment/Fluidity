const { Demande } = require('../models/demande.model');
const { Utilisateur } = require('../models/user.model');
const { Contrat } = require('../models/contrat.model');

/**
 * Demandes de démonstration couvrant TOUT LE WORKFLOW (§2.2.2) :
 *   Ouverte -> En cours d'analyse -> En attente de validation
 *   -> En cours de réalisation -> Réalisée -> Clôturée
 *   (+ En attente client, Rejetée, Annulé)
 *
 * Objectif : chaque rôle trouve des dossiers sur lesquels agir au login
 * (AGENT : analyse/réalisation, MANAGER : validation, CLIENT : réponse,
 * clôture, annulation), dans les deux tenants (isolation comprise).
 *
 * Les statuts sont injectés directement (données de démo, pas de parcours
 * réel du workflow) — jamais en production.
 */
const seedDemandes = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — demandes non créées.');
    return;
  }

  // Comptes CLIENT demandeurs (requester, ObjectId)
  const [atlas, helios, novaClient] = await Promise.all([
    Utilisateur.findOne({ email: 'client@fluidity.dev' }),
    Utilisateur.findOne({ email: 'client2@fluidity.dev' }),
    Utilisateur.findOne({ email: 'client@nova-systems.dev' }),
  ]);
  // Contrats actifs de rattachement (ObjectId)
  const [ctrAtlas, ctrAtlas2, ctrHelios, ctrNova] = await Promise.all([
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-001' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-002' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-020' }),
    Contrat.findOne({ tenantId: nova._id, reference: 'CTR-2026-101' }),
  ]);
  if (!atlas || !helios || !novaClient || !ctrAtlas || !ctrAtlas2 || !ctrHelios || !ctrNova) {
    console.warn('[Seed] Comptes/contrats de démonstration absents — demandes non créées.');
    return;
  }

  const demoDemandes = [
    // --- Statut : Ouverte (actions AGENT disponibles) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Ouverte',
      objet: 'Extension des ressources de la VM e-commerce',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'VM', sousCategorie: 'Extension ressources',
      descriptionDetaillee:
        'La VM hébergeant la boutique en ligne sature en période de soldes (CPU > 90 %). ' +
        'Nous souhaitons passer de 4 à 8 vCPU et de 16 à 32 Go de RAM.',
      prioriteSouhaitee: 'Urgente', contrat: ctrAtlas._id,
      dateSouhaiteeRealisation: new Date('2026-07-30'),
      informationsComplementaires: 'Fenêtre préférée : nuit du jeudi au vendredi.',
    },
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Ouverte',
      objet: 'Ouverture de flux HTTPS vers notre API partenaire',
      typeDemande: "Modification d'accès", serviceEnvironnement: 'Production',
      categorie: 'Réseau', sousCategorie: 'Autre',
      descriptionDetaillee:
        'Merci d\'autoriser le flux sortant TCP/443 de notre VLAN applicatif (10.20.0.0/24) ' +
        'vers api.helios-partner.tn (203.0.113.45) pour l\'intégration du nouveau logiciel logistique.',
      prioriteSouhaitee: 'Standard', contrat: ctrHelios._id,
    },
    // --- Statut : En cours d'analyse (AGENT peut valider/réaliser/rejeter) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: "En cours d'analyse",
      objet: 'Restauration de la base PostgreSQL de recette',
      typeDemande: 'Support technique', serviceEnvironnement: 'Test',
      categorie: 'Sauvegarde', sousCategorie: 'Restore',
      descriptionDetaillee:
        'Suite à un script de migration erroné en recette, nous avons besoin d\'une restauration ' +
        'de la base recette_ecommerce à l\'état du 24/07 02h00 (sauvegarde quotidienne Veeam).',
      prioriteSouhaitee: 'Élevée', contrat: ctrAtlas2._id,
      dateSouhaiteeRealisation: new Date('2026-07-28'),
    },
    {
      tenantId: fluidity._id, requester: helios._id, statut: "En cours d'analyse",
      objet: 'Activation du MFA sur tous les accès administrateurs',
      typeDemande: "Modification d'accès", serviceEnvironnement: 'Production',
      categorie: 'Sécurité', sousCategorie: 'Autre',
      descriptionDetaillee:
        'Dans le cadre de notre audit ISO 27001, merci d\'activer l\'authentification multifacteur ' +
        'pour les 6 comptes administrateurs de l\'infrastructure hébergée.',
      prioriteSouhaitee: 'Standard', contrat: ctrHelios._id,
    },
    // --- Statut : En attente de validation (action MANAGER) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'En attente de validation',
      objet: 'Ajout d\'un second serveur physique au cluster',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'VM', sousCategorie: 'Extension ressources',
      descriptionDetaillee:
        'Le cluster de virtualisation atteint 85 % de capacité. Nous demandons l\'ajout d\'un hôte ' +
        'supplémentaire (devis matériel validé avec le commercial le 18/07).',
      prioriteSouhaitee: 'Urgente', contrat: ctrAtlas2._id,
      dateSouhaiteeRealisation: new Date('2026-08-15'),
      informationsComplementaires: 'Budget 2026 validé en comité de direction.',
    },
    // --- Statut : En cours de réalisation ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'En cours de réalisation',
      objet: 'Extension du volume SAN /data de 2 To',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'Stockage', sousCategorie: 'Extension capacité',
      descriptionDetaillee:
        'Le volume /data des rapports BI atteint 92 %. Extension de 2 To sur la baie SAN existante ' +
        'déjà provisionnée sous le contrat hébergement.',
      prioriteSouhaitee: 'Élevée', contrat: ctrAtlas._id,
      dateSouhaiteeRealisation: new Date('2026-07-27'),
    },
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'En cours de réalisation',
      objet: 'Renouvellement du certificat SSL du portail clients',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'Sécurité', sousCategorie: 'Certificat',
      descriptionDetaillee:
        'Le certificat du portail clients.helios.tn expire le 02/08. Merci de déployer le nouveau ' +
        'certificat (fourni par notre autorité) sur le frontal Nginx.',
      prioriteSouhaitee: 'Standard', contrat: ctrHelios._id,
    },
    // --- Statut : En attente client (CLIENT peut répondre / AGENT peut clôturer) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'En attente client',
      objet: 'Création d\'un VLAN isolé pour l\'environnement IoT',
      typeDemande: "Modification d'accès", serviceEnvironnement: 'Pré-production',
      categorie: 'Réseau', sousCategorie: 'VLAN',
      descriptionDetaillee:
        'Nous souhaitons un VLAN dédié aux équipements IoT de l\'entrepôt (environ 40 devices), ' +
        'sans accès au LAN bureautique.',
      prioriteSouhaitee: 'Élevée', contrat: ctrAtlas._id,
      informationsComplementaires: 'En attente de la plage IP souhaitée par le client.',
    },
    // --- Statut : Réalisée (CLIENT peut clôturer) ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Réalisée',
      objet: 'Snapshot avant mise à jour de l\'ERP',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'VM', sousCategorie: 'Snapshot',
      descriptionDetaillee:
        'Merci de réaliser un snapshot complet des VM erp-app-01 et erp-db-01 avant notre montée ' +
        'de version prévue ce week-end.',
      prioriteSouhaitee: 'Standard', contrat: ctrHelios._id,
    },
    // --- Statut : Clôturée (historique complet) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Clôturée',
      objet: 'Création d\'un compte de service pour le reporting',
      typeDemande: 'Création de compte', serviceEnvironnement: 'Production',
      categorie: 'Sécurité', sousCategorie: 'Autre',
      descriptionDetaillee:
        'Création d\'un compte de service en lecture seule pour l\'outil de reporting Power BI ' +
        '(accès base de données analytique uniquement).',
      prioriteSouhaitee: 'Standard', contrat: ctrAtlas._id,
    },
    // --- Statut : Rejetée (historique, éligibilité refusée) ---
    {
      tenantId: fluidity._id, requester: helios._id, statut: 'Rejetée',
      objet: 'Allocation de 8 GPU pour entraînement IA intensif',
      typeDemande: 'Support technique', serviceEnvironnement: 'Développement',
      categorie: 'IA-GPU', sousCategorie: 'GPU Allocation',
      descriptionDetaillee:
        'Nous souhaitons 8 GPU A100 pendant 3 mois pour l\'entraînement de notre modèle de ' +
        'prévision logistique.',
      prioriteSouhaitee: 'Urgente', contrat: ctrHelios._id,
      informationsComplementaires: 'Rejetée : capacité GPU du cluster insuffisante ce trimestre.',
    },
    // --- Statut : Annulé (figé, historique conservé) ---
    {
      tenantId: fluidity._id, requester: atlas._id, statut: 'Annulé',
      objet: 'Restauration d\'un fichier supprimé par erreur',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'Sauvegarde', sousCategorie: 'Restore',
      descriptionDetaillee:
        'Restauration du dossier partagé /compta/exports du 15/07. Annulée par le client : ' +
        'le fichier a été retrouvé dans la corbeille réseau.',
      prioriteSouhaitee: 'Élevée', contrat: ctrAtlas._id,
    },

    // ================= Tenant « Nova Systems » (isolation) =================
    {
      tenantId: nova._id, requester: novaClient._id, statut: 'Ouverte',
      objet: 'Intermittences réseau sur le site principal',
      typeDemande: 'Support technique', serviceEnvironnement: 'Production',
      categorie: 'Réseau', sousCategorie: 'Routage',
      descriptionDetaillee:
        'Nous constatons des microcoupures (~2 s) toutes les 20 minutes sur le lien principal. ' +
        'Impact sur la synchronisation des caisses.',
      prioriteSouhaitee: 'Élevée', contrat: ctrNova._id,
    },
    {
      tenantId: nova._id, requester: novaClient._id, statut: "En cours d'analyse",
      objet: 'Mise à jour du cluster Kubernetes en 1.30',
      typeDemande: 'Support technique', serviceEnvironnement: 'Pré-production',
      categorie: 'VM', sousCategorie: 'Autre',
      descriptionDetaillee:
        'Merci de planifier la mise à niveau du cluster K8s de pré-production vers la 1.30 et de ' +
        'vérifier la compatibilité de nos charts Helm.',
      prioriteSouhaitee: 'Standard', contrat: ctrNova._id,
    },
    {
      tenantId: nova._id, requester: novaClient._id, statut: 'Réalisée',
      objet: 'Rapport de capacité du dernier trimestre',
      typeDemande: "Demande d'information", serviceEnvironnement: 'Production',
      categorie: 'VM', sousCategorie: 'Autre',
      descriptionDetaillee:
        'Nous souhaitons le rapport de consommation (CPU/RAM/stockage) de nos VM pour préparer ' +
        'le budget 2027.',
      prioriteSouhaitee: 'Standard', contrat: ctrNova._id,
    },
  ];

  // Additif et idempotent PAR TENANT : le jeu de démo d'un tenant n'est
  // inséré que si ce tenant n'a encore AUCUNE demande — jamais de doublon
  // au fil des relances, et les données réelles ne sont jamais touchées.
  let created = 0;
  for (const tenant of [fluidity, nova]) {
    const existing = await Demande.countDocuments({ tenantId: tenant._id });
    if (existing > 0) continue;
    const docs = demoDemandes.filter((d) => String(d.tenantId) === String(tenant._id));
    if (docs.length) {
      await Demande.insertMany(docs);
      created += docs.length;
    }
  }
  console.log(
    created > 0
      ? `[Seed] ${created} demandes de démonstration créées dans db.demandes (tous les statuts du workflow).`
      : '[Seed] Demandes de démonstration déjà présentes — aucun ajout.'
  );
};

module.exports = { seedDemandes };

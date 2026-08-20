const { Changement } = require('../models/changement.model');

/**
 * Changements de démonstration couvrant plusieurs catégories, spécifications
 * dynamiques et statuts de workflow.
 */
const demoChangements = [
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    objetChangement: 'Mise à jour des règles du pare-feu périmétrique',
    descriptionDetaillee: 'Ajout de règles entrantes pour le nouveau service exposé sur le port 443.',
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Firewall',
    planRetourArriere: 'Sauvegarde de la configuration du pare-feu avant modification.',
    typeChangement: 'Standard',
    statut: 'Soumis',
    specifications: {
      general: { ressourcesConcernees: 'Pare-feu périmétrique', commentaire: 'Fenêtre de maintenance à confirmer.' },
      firewall: { source: 'WAN', destination: 'DMZ', protocole: 'TCP', ports: '443', action: 'Autoriser' },
    },
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-002',
    objetChangement: 'Création de VM applicative (app-02)',
    descriptionDetaillee: 'Provisionnement d’une nouvelle VM pour le module facturation.',
    serviceEnvironnement: 'Production',
    categorie: 'VM',
    sousCategorie: 'Création VM',
    planRetourArriere: 'Suppression de la VM en cas de non-conformité.',
    typeChangement: 'Standard',
    statut: 'Planifié',
    specifications: {
      general: { ressourcesConcernees: 'Cluster vSphere production' },
      serveur: {
        hostname: 'app-02',
        os: 'Ubuntu 22.04',
        cpuCores: 4,
        ramGo: 16,
        disques: [{ capaciteGo: 200, type: 'NVMe' }],
        environnementVm: 'Production',
      },
    },
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-002',
    objetChangement: 'Extension du volume de stockage NFS',
    descriptionDetaillee: 'Ajout de 500 Go sur le partage NFS des données métier.',
    serviceEnvironnement: 'Production',
    categorie: 'Stockage',
    sousCategorie: 'Extension capacité',
    planRetourArriere: 'Extension réversible : le volume est simplement agrandi.',
    typeChangement: 'Majeur',
    statut: 'Approuvé',
    specifications: {
      general: { ressourcesConcernees: 'Baie de stockage SAN' },
      stockage: [{ typeStockage: 'NAS', protocole: 'NFS', capaciteGo: 500 }],
    },
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    objetChangement: 'Renouvellement du certificat SSL du portail',
    descriptionDetaillee: 'Renouvellement du certificat wildcard expirant fin de mois.',
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Certificat',
    planRetourArriere: 'Conservation du certificat actif jusqu’au basculement.',
    typeChangement: 'Standard',
    statut: 'Clôturé',
    specifications: {
      general: { ressourcesConcernees: 'Reverse proxy' },
      securite: { typeCertificat: 'Wildcard', nomCommun: '*.nova-systems.dev', validite: '1 an' },
    },
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    objetChangement: 'Mise à jour des pilotes GPU (CUDA 12)',
    descriptionDetaillee: 'Passage des pilotes NVIDIA et du toolkit CUDA à la version 12.x.',
    serviceEnvironnement: 'Développement',
    categorie: 'IA-GPU',
    sousCategorie: 'Drivers',
    planRetourArriere: 'Snapshot du nœud GPU avant mise à jour.',
    typeChangement: 'Majeur',
    statut: "En cours d'implémentation",
    specifications: {
      general: { ressourcesConcernees: 'Nœud gpu-01' },
      iaGpu: { typeGpu: 'NVIDIA A100', versionPiloteDemandee: '535.x', compatibiliteCuda: 'CUDA 12.2' },
    },
  },
];

/**
 * Insère les changements de démonstration (idempotent par objet + requester).
 */
const seedChangements = async (ctx = {}) => {
  const { users = {}, clients = {}, contrats = {} } = ctx;
  let created = 0;
  for (const c of demoChangements) {
    const exists = await Changement.findOne({ objetChangement: c.objetChangement, requester: users[c.requesterEmail]._id });
    if (exists) continue;
    const { clientEmail, requesterEmail, contratRef, ...data } = c;
    await Changement.create({
      ...data,
      clientId: clients[clientEmail]._id,
      requester: users[requesterEmail]._id,
      contrat: contrats[contratRef]._id,
    });
    created += 1;
  }
  console.log(
    created > 0
      ? `[Seed] Changements : ${created} créé(s).`
      : '[Seed] Changements de démonstration déjà présents.'
  );
};

module.exports = { demoChangements, seedChangements };

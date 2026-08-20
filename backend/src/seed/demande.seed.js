const { Demande } = require('../models/demande.model');

/**
 * Demandes de démonstration couvrant plusieurs catégories, sous-catégories
 * et statuts de workflow.
 */
const demoDemandes = [
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    objet: "Création d'un VLAN de test pour l'équipe QA",
    typeDemande: "Modification d'accès",
    serviceEnvironnement: 'Pré-production',
    categorie: 'Réseau',
    sousCategorie: 'VLAN',
    descriptionDetaillee: "Ajout d'un VLAN isolé pour l'environnement de pré-production de l'équipe QA.",
    prioriteSouhaitee: 'Standard',
    statut: 'Ouverte',
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    objet: 'Extension de RAM sur le serveur applicatif',
    typeDemande: 'Support technique',
    serviceEnvironnement: 'Production',
    categorie: 'VM',
    sousCategorie: 'Extension ressources',
    descriptionDetaillee: 'Passage de 16 Go à 32 Go de RAM sur la VM app-01 pour absorber le pic de charge.',
    prioriteSouhaitee: 'Élevée',
    statut: "En cours d'analyse",
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-002',
    objet: 'Allocation de GPU pour entraînement de modèle',
    typeDemande: 'Support technique',
    serviceEnvironnement: 'Développement',
    categorie: 'IA-GPU',
    sousCategorie: 'GPU Allocation',
    descriptionDetaillee: "Besoin d'une carte A100 pour l'entraînement d'un modèle de vision.",
    prioriteSouhaitee: 'Standard',
    statut: 'Réalisée',
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    objet: 'Audit de sécurité de la passerelle DMZ',
    typeDemande: "Demande d'information",
    serviceEnvironnement: 'Production',
    categorie: 'Sécurité',
    sousCategorie: 'Audit',
    descriptionDetaillee: 'Audit de configuration de la passerelle exposant nos services publics.',
    prioriteSouhaitee: 'Élevée',
    statut: 'En attente de validation',
  },
];

/**
 * Insère les demandes de démonstration (idempotent par objet + client).
 */
const seedDemandes = async (ctx = {}) => {
  const { users = {}, clients = {}, contrats = {} } = ctx;
  let created = 0;
  for (const d of demoDemandes) {
    const exists = await Demande.findOne({ objet: d.objet, requester: users[d.requesterEmail]._id });
    if (exists) continue;
    const { clientEmail, requesterEmail, contratRef, ...data } = d;
    await Demande.create({
      ...data,
      clientId: clients[clientEmail]._id,
      requester: users[requesterEmail]._id,
      contrat: contrats[contratRef]._id,
    });
    created += 1;
  }
  console.log(
    created > 0
      ? `[Seed] Demandes : ${created} créée(s).`
      : '[Seed] Demandes de démonstration déjà présentes.'
  );
};

module.exports = { demoDemandes, seedDemandes };

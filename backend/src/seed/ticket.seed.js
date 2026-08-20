const { Ticket, TicketSequence } = require('../models/ticket.model');
const { TicketComment } = require('../models/ticket-comment.model');
const { TicketActivity } = require('../models/ticket-activity.model');
const { calculatePriority } = require('../utils/ticket-priority');
const { initSla } = require('../utils/ticket-sla');

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

/**
 * Tickets / incidents de démonstration couvrant tous les impacts, urgences,
 * priorités calculées et principaux états du workflow.
 */
const demoTickets = [
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    reference: 'INC-2026-0001',
    statut: 'Nouveau',
    objet: 'Lenteur du portail intranet',
    descriptionDetaillee: 'Le portail intranet répond en plus de 10 secondes depuis ce matin.',
    categorie: 'VM',
    sousCategorie: 'Extension ressources',
    impact: 'Moyen',
    urgence: 'Moyenne',
    ageHours: 1,
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    reference: 'INC-2026-0002',
    statut: 'Affecté',
    objet: 'Tunnel VPN siège instable',
    descriptionDetaillee: 'Le tunnel IPsec tombe toutes les deux heures.',
    categorie: 'Réseau',
    sousCategorie: 'VPN',
    impact: 'Élevé',
    urgence: 'Moyenne',
    assignedTeam: 'Réseau',
    ageHours: 14,
    specifications: { reseau: { typeVpn: 'IPSec', peerGateway: 'siege.fluidity.tn' } },
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-002',
    reference: 'INC-2026-0003',
    statut: "En cours d'analyse",
    objet: 'SAN iSCSI timeouts',
    descriptionDetaillee: 'Timeouts iSCSI sur le volume des données métier.',
    categorie: 'Stockage',
    sousCategorie: 'SAN',
    impact: 'Critique',
    urgence: 'Moyenne',
    assignedTeam: 'Système',
    ageHours: 9,
    specifications: { stockage: [{ typeStockage: 'SAN', protocole: 'iSCSI', capaciteGo: 2000 }] },
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-002',
    reference: 'INC-2026-0004',
    statut: 'En attente client',
    objet: 'Préciser la fenêtre de restore ERP',
    descriptionDetaillee: 'Restore ERP demandé — en attente de la fenêtre validée par le métier.',
    categorie: 'Sauvegarde',
    sousCategorie: 'Restore',
    impact: 'Élevé',
    urgence: 'Faible',
    assignedTeam: 'Support N1',
    attenteMotif: 'Fenêtre de maintenance',
    attenteDepuis: hoursAgo(30),
    ageHours: 40,
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    reference: 'INC-2026-0005',
    statut: 'En cours de résolution',
    objet: 'Latence disque élevée sur la base',
    descriptionDetaillee: 'Latence d’écriture anormale sur le volume de la base de données.',
    categorie: 'Stockage',
    sousCategorie: 'Volume',
    impact: 'Élevé',
    urgence: 'Élevée',
    assignedTeam: 'Système',
    ageHours: 18,
  },
  {
    clientEmail: 'client@fluidity.dev',
    requesterEmail: 'client@fluidity.dev',
    contratRef: 'CTR-2026-001',
    reference: 'INC-2026-0006',
    statut: 'Résolu',
    objet: 'Certificat caisse renouvelé',
    descriptionDetaillee: 'Renouvellement SSL des terminaux caisse.',
    categorie: 'Sécurité',
    sousCategorie: 'Certificat',
    impact: 'Faible',
    urgence: 'Moyenne',
    assignedTeam: 'Support N1',
    ageHours: 60,
    resolution: { resume: 'Certificats déployés sur les 8 terminaux.', resolvedAt: hoursAgo(8) },
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    reference: 'INC-2026-0007',
    statut: 'Clôturé',
    objet: 'Restauration des sauvegardes Veeam',
    descriptionDetaillee: 'Restauration d’une arborescence supprimée par erreur.',
    categorie: 'Sauvegarde',
    sousCategorie: 'Veeam',
    impact: 'Moyen',
    urgence: 'Élevée',
    assignedTeam: 'Support N1',
    ageHours: 200,
    resolution: { resume: 'Restauration validée.', closedAt: hoursAgo(150), confirmationClient: true },
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    reference: 'INC-2026-0008',
    statut: 'Réouvert',
    objet: 'Règle firewall toujours en échec',
    descriptionDetaillee: 'La règle autorisant le flux reste en échec après la première résolution.',
    categorie: 'Sécurité',
    sousCategorie: 'Firewall',
    impact: 'Critique',
    urgence: 'Critique',
    assignedTeam: 'Sécurité',
    ageHours: 30,
  },
  {
    clientEmail: 'client2@fluidity.dev',
    requesterEmail: 'client2@fluidity.dev',
    contratRef: 'CTR-2026-101',
    reference: 'INC-2026-0009',
    statut: 'En attente tiers',
    objet: 'Intervention constructeur baie de stockage',
    descriptionDetaillee: 'Disque défaillant signalé au constructeur, en attente de remplacement.',
    categorie: 'Stockage',
    sousCategorie: 'SAN',
    impact: 'Faible',
    urgence: 'Faible',
    assignedTeam: 'Stockage',
    attenteMotif: 'Ticket constructeur ouvert',
    attenteDepuis: hoursAgo(20),
    ageHours: 26,
  },
];

/**
 * Insère les tickets de démonstration (idempotent par référence) et
 * initialise la séquence de références.
 */
const seedTickets = async (ctx = {}) => {
  const { users = {}, clients = {}, contrats = {} } = ctx;
  let created = 0;
  for (const t of demoTickets) {
    const exists = await Ticket.findOne({ reference: t.reference });
    if (exists) continue;

    const { clientEmail, requesterEmail, contratRef, ageHours, ...data } = t;
    const priorite = calculatePriority(t.impact, t.urgence);

    const ticket = new Ticket({
      ...data,
      clientId: clients[clientEmail]._id,
      contrat: contrats[contratRef]._id,
      createdBy: users[requesterEmail]._id,
      type: 'Incident',
      priorite,
      openedAt: hoursAgo(ageHours),
    });
    initSla(ticket, hoursAgo(ageHours));
    await ticket.save();
    created += 1;

    // Séquence de références
    const year = 2026;
    const seq = Number(t.reference.split('-').pop());
    await TicketSequence.findOneAndUpdate({ year }, { $max: { seq } }, { upsert: true });

    await TicketActivity.create({
      ticketId: ticket._id,
      action: 'creation',
      visibilite: 'public',
      acteur: users[requesterEmail]._id,
      acteurEmail: requesterEmail,
      metadata: { reference: ticket.reference, priorite },
    });
    if (ticket.statut !== 'Nouveau') {
      await TicketActivity.create({
        ticketId: ticket._id,
        action: 'statut',
        visibilite: 'public',
        acteurEmail: 'systeme',
        metadata: { de: 'Nouveau', vers: ticket.statut },
      });
    }
    await TicketComment.create({
      ticketId: ticket._id,
      visibilite: 'public',
      corps: `Bonjour, merci de traiter l’incident ${ticket.reference} en priorité ${priorite}.`,
      auteur: users[requesterEmail]._id,
    });
  }
  console.log(
    created > 0
      ? `[Seed] Tickets : ${created} créé(s).`
      : '[Seed] Tickets de démonstration déjà présents.'
  );
};

module.exports = { demoTickets, seedTickets };

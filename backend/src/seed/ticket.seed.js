const { Ticket, TicketSequence } = require('../models/ticket.model');
const { TicketComment } = require('../models/ticket-comment.model');
const { TicketActivity } = require('../models/ticket-activity.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Utilisateur } = require('../models/user.model');
const { calculatePriority } = require('../utils/ticket-priority');
const { initSla, applySlaOnTransition } = require('../utils/ticket-sla');

function ticketDoc(base) {
  const priorite = calculatePriority(base.impact, base.urgence);
  const openedAt = base.openedAt || new Date(Date.now() - (base.ageHours || 6) * 3600 * 1000);
  const slaOverride = base.slaOverride;
  const doc = {
    ...base,
    type: 'Incident',
    priorite,
    openedAt,
    piecesJointes: base.piecesJointes || [],
    diagnostic: base.diagnostic || {},
    specifications: base.specifications || {},
  };
  delete doc.ageHours;
  delete doc.slaOverride;
  delete doc.attenteMotif;
  // attenteMotif is a real field — restore after construct if needed
  if (base.attenteMotif) doc.attenteMotif = base.attenteMotif;
  const t = new Ticket(doc);
  initSla(t, openedAt);
  if (base.statut && base.statut !== 'Nouveau') {
    applySlaOnTransition(t, 'Nouveau', base.statut === 'Affecté' ? 'Affecté' : "En cours d'analyse", openedAt);
  }
  if (['En attente client', 'En attente tiers'].includes(base.statut)) {
    applySlaOnTransition(t, "En cours d'analyse", base.statut, new Date(openedAt.getTime() + 2 * 3600 * 1000));
    t.attenteMotif = base.attenteMotif || 'Information complémentaire requise';
    t.attenteDepuis = base.attenteDepuis || new Date(openedAt.getTime() + 2 * 3600 * 1000);
  }
  if (slaOverride) Object.assign(t.sla, slaOverride);
  if (base.resolution) t.resolution = { ...t.resolution?.toObject?.(), ...base.resolution };
  return t;
}

const seedTickets = async (tenants = {}) => {
  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  const carthage = tenants['Carthage Digital'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants absents — tickets non créés.');
    return;
  }

  const [atlas, helios, maghreb, novaRetail, novaLog, carthageRetail] = await Promise.all([
    Client.findOne({ tenantId: fluidity._id, email: 'client@fluidity.dev' }),
    Client.findOne({ tenantId: fluidity._id, email: 'client2@fluidity.dev' }),
    Client.findOne({ tenantId: fluidity._id, email: 'maghreb@fluidity.dev' }),
    Client.findOne({ tenantId: nova._id, email: 'client@nova-systems.dev' }),
    Client.findOne({ tenantId: nova._id, email: 'logistique@nova-systems.dev' }),
    carthage ? Client.findOne({ tenantId: carthage._id, email: 'retail@carthage-demo.local' }) : null,
  ]);
  const [ctrAtlas, ctrHelios, ctrMaghreb, ctrNova, ctrNovaLog, ctrC] = await Promise.all([
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-001' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-020' }),
    Contrat.findOne({ tenantId: fluidity._id, reference: 'CTR-2026-030' }),
    Contrat.findOne({ tenantId: nova._id, reference: 'CTR-2026-101' }),
    Contrat.findOne({ tenantId: nova._id, reference: 'CTR-2026-110' }),
    carthage ? Contrat.findOne({ tenantId: carthage._id, reference: 'CTR-2026-201' }) : null,
  ]);

  const [sarah, ahmed, karim, lina, youssef, selma, ines, sami, dora, tarek, aya] = await Promise.all([
    Utilisateur.findOne({ email: 'sarah.n1@fluidity.dev' }),
    Utilisateur.findOne({ email: 'ahmed.reseau@fluidity.dev' }),
    Utilisateur.findOne({ email: 'karim.stockage@fluidity.dev' }),
    Utilisateur.findOne({ email: 'lina.cloud@fluidity.dev' }),
    Utilisateur.findOne({ email: 'youssef.secu@fluidity.dev' }),
    Utilisateur.findOne({ email: 'selma.ops@fluidity.dev' }),
    Utilisateur.findOne({ email: 'agent@nova-systems.dev' }),
    Utilisateur.findOne({ email: 'manager@nova-systems.dev' }),
    Utilisateur.findOne({ email: 'dora.reseau@nova-systems.dev' }),
    Utilisateur.findOne({ email: 'n1@carthage-demo.local' }),
    Utilisateur.findOne({ email: 'n2.systeme@carthage-demo.local' }),
  ]);

  if (!atlas || !helios || !ctrAtlas || !ctrHelios) {
    console.warn('[Seed] Clients/contrats Fluidity absents — tickets non créés.');
    return;
  }

  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000);

  const fluidityTickets = [
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0001', statut: 'Nouveau', objet: 'Boutique en ligne inaccessible',
      descriptionDetaillee: 'La boutique shop.atlas.tn renvoie 502 depuis 07h15. Périmètre : front Nginx + API. Aucun déploiement déclaré.',
      categorie: 'VM', sousCategorie: 'Création VM', impact: 'Critique', urgence: 'Critique', ageHours: 2,
      specifications: { general: { ressourcesConcernees: 'shop-prod-01' }, serveur: { hostname: 'shop-prod-01', environnementVm: 'Production' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0002', statut: 'Affecté', objet: 'Latence DNS interne',
      descriptionDetaillee: 'Résolution DNS interne > 2 s sur le VLAN applicatif.',
      categorie: 'Réseau', sousCategorie: 'DNS', impact: 'Élevé', urgence: 'Critique',
      assignedTeam: 'Réseau', assignedTo: ahmed?._id, ageHours: 5,
      specifications: { reseau: { zoneDns: 'atlas.lan', typeEnregistrement: 'A', nomEnregistrement: 'api' } },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0003', statut: "En cours d'analyse", objet: 'Règle firewall bloquant l’API partenaire',
      descriptionDetaillee: 'Les appels HTTPS vers api.helios-partner.tn sont refusés depuis le VLAN 20.',
      categorie: 'Sécurité', sousCategorie: 'Firewall', impact: 'Élevé', urgence: 'Élevée',
      assignedTeam: 'Sécurité', assignedTo: youssef?._id, ageHours: 8,
      specifications: { firewall: { source: '10.20.0.0/24', destination: '203.0.113.45', protocole: 'TCP', ports: '443', action: 'Autoriser', direction: 'Sortant' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0004', statut: 'En attente client', objet: 'Quota NAS saturé — besoin du dossier à purger',
      descriptionDetaillee: 'Le partage NAS /finance atteint 98 %. Merci d’indiquer les répertoires archivables.',
      categorie: 'Stockage', sousCategorie: 'Quotas', impact: 'Moyen', urgence: 'Élevée',
      assignedTeam: 'Stockage', assignedTo: karim?._id, attenteMotif: 'Liste des dossiers à archiver',
      attenteDepuis: hoursAgo(20), ageHours: 30,
      specifications: { stockage: [{ typeStockage: 'NAS', protocole: 'NFS', capaciteGo: 2048 }] },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0005', statut: 'En attente tiers', objet: 'Lien opérateur instable (ticket fournisseur ouvert)',
      descriptionDetaillee: 'Microcoupures sur le lien principal. Ticket opérateur #OP-88421.',
      categorie: 'Réseau', sousCategorie: 'Routage', impact: 'Élevé', urgence: 'Critique',
      assignedTeam: 'Réseau', assignedTo: ahmed?._id, attenteMotif: 'Attente diagnostic opérateur',
      attenteDepuis: hoursAgo(10), ageHours: 16,
      specifications: { reseau: { reseauDestination: '0.0.0.0/0', protocoleRoutage: 'BGP' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0006', statut: 'En cours de résolution', objet: 'Échec job Veeam VM-finances',
      descriptionDetaillee: 'Le job Veeam VM-finances échoue depuis 2 nuits (erreur repository plein).',
      categorie: 'Sauvegarde', sousCategorie: 'Veeam', impact: 'Moyen', urgence: 'Moyenne',
      assignedTeam: 'Support N1', assignedTo: sarah?._id, ageHours: 40,
      specifications: { backup: { nomJobVeeam: 'VM-finances', typeBackupVeeam: 'Incremental', repository: 'Repo-A' } },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0007', statut: 'Résolu', objet: 'Certificat SSL renouvelé sur le portail',
      descriptionDetaillee: 'Le certificat clients.helios.tn expirait. Nouveau certificat déployé sur Nginx.',
      categorie: 'Sécurité', sousCategorie: 'Certificat', impact: 'Faible', urgence: 'Élevée',
      assignedTeam: 'Sécurité', assignedTo: youssef?._id, ageHours: 50,
      resolution: { resume: 'Certificat déployé, chaîne complète, HTTPS OK.', resolvedAt: hoursAgo(10), resolvedBy: youssef?._id, resolvedByModel: 'Utilisateur' },
      specifications: { securite: { typeCertificat: 'OV', nomCommun: 'clients.helios.tn', renouvellementOuNouveau: 'Renouvellement' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0008', statut: 'Clôturé', objet: 'Création compte de service reporting',
      descriptionDetaillee: 'Compte lecture seule Power BI créé. Confirmé par le client.',
      categorie: 'Sécurité', sousCategorie: 'Autre', impact: 'Faible', urgence: 'Faible',
      assignedTeam: 'Support N1', assignedTo: sarah?._id, ageHours: 120,
      resolution: { resume: 'Compte svc-pbi créé.', resolvedAt: hoursAgo(80), closedAt: hoursAgo(70), confirmationClient: true, closedReason: 'Confirmation client' },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0009', statut: 'Réouvert', objet: 'GPU inference toujours hors service après « résolution »',
      descriptionDetaillee: 'Le service de recommandation plante encore après le redémarrage du nœud gpu-01.',
      categorie: 'IA-GPU', sousCategorie: 'Drivers', impact: 'Élevé', urgence: 'Élevée',
      assignedTeam: 'Cloud', assignedTo: lina?._id, ageHours: 28,
      specifications: { iaGpu: { typeGpu: 'NVIDIA A100', versionPiloteActuelle: '550.54', versionPiloteDemandee: '550.90', serveurCible: 'gpu-01' } },
    },
    {
      tenantId: fluidity._id, clientId: maghreb?._id || atlas._id, contrat: ctrMaghreb?._id || ctrAtlas._id,
      createdBy: maghreb?._id || atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0010', statut: "En cours d'analyse", objet: 'Volume NFS en lecture seule',
      descriptionDetaillee: 'Le mount /data/exports est passé en read-only après un fsck.',
      categorie: 'Stockage', sousCategorie: 'NFS', impact: 'Critique', urgence: 'Élevée',
      assignedTeam: 'Stockage', assignedTo: karim?._id, ageHours: 4,
      specifications: { stockage: [{ typeStockage: 'NAS', protocole: 'NFS', capaciteGo: 1024 }] },
      slaOverride: { resolutionDueAt: hoursAgo(-0.5) },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0011', statut: 'Nouveau', objet: 'SSID invités ne diffuse plus',
      descriptionDetaillee: 'Le SSID Atlas-Invite a disparu des AP du 2e étage.',
      categorie: 'Réseau', sousCategorie: 'WiFi', impact: 'Faible', urgence: 'Moyenne', ageHours: 1,
      specifications: { reseau: { ssid: 'Atlas-Invite', modeSecurite: 'WPA2-Enterprise' } },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0012', statut: 'Affecté', objet: 'Clone VM recette impossible',
      descriptionDetaillee: 'Le clone de recette-app-01 échoue (datastore plein).',
      categorie: 'VM', sousCategorie: 'Clone', impact: 'Moyen', urgence: 'Faible',
      assignedTeam: 'Système', assignedTo: selma?._id, ageHours: 12,
      specifications: { serveur: { vmSource: 'recette-app-01', nouveauNomVm: 'recette-app-02' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0013', statut: 'En cours de résolution', objet: 'Proxy sortant timeout vers Debian repos',
      descriptionDetaillee: 'apt update timeout via le proxy d’entreprise.',
      categorie: 'Réseau', sousCategorie: 'Proxy', impact: 'Faible', urgence: 'Critique',
      assignedTeam: 'Réseau', assignedTo: ahmed?._id, ageHours: 7,
      specifications: { reseau: { typeProxy: 'HTTP', hostProxy: 'proxy.atlas.lan', portProxy: '3128' } },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0014', statut: "En cours d'analyse", objet: 'Audit logs SIEM incomplets',
      descriptionDetaillee: 'Les journaux firewall n’arrivent plus dans le SIEM depuis 18h.',
      categorie: 'Sécurité', sousCategorie: 'Audit', impact: 'Moyen', urgence: 'Moyenne',
      assignedTeam: 'Sécurité', assignedTo: youssef?._id, ageHours: 18,
      specifications: { securite: { typeAudit: 'Journalisation', systemeCible: 'SIEM', periodeAudit: '48h' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0015', statut: 'Résolu', objet: 'Restore fichier compta OK',
      descriptionDetaillee: 'Fichier /compta/exports/juillet.xlsx restauré depuis Veeam J-1.',
      categorie: 'Sauvegarde', sousCategorie: 'Restore', impact: 'Faible', urgence: 'Faible',
      assignedTeam: 'Support N1', assignedTo: sarah?._id, ageHours: 60,
      resolution: { resume: 'Fichier restauré dans /restore/atlas/.', resolvedAt: hoursAgo(5), resolvedBy: sarah?._id, resolvedByModel: 'Utilisateur' },
      specifications: { backup: { sourceBackup: 'Veeam J-1', typeRestore: 'Fichier', cibleRestore: '/restore/atlas' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0016', statut: 'Nouveau', objet: 'Scope DHCP épuisé VLAN 30',
      descriptionDetaillee: 'Plus d’adresses libres dans le pool DHCP du VLAN 30 (WiFi collaborateurs).',
      categorie: 'Réseau', sousCategorie: 'DHCP', impact: 'Moyen', urgence: 'Critique', ageHours: 2,
      specifications: { reseau: { scopePool: 'VLAN30', plageAdresses: '10.30.0.50-10.30.0.250' } },
    },
    {
      tenantId: fluidity._id, clientId: helios._id, contrat: ctrHelios._id, createdBy: helios._id, createdByModel: 'Client',
      reference: 'INC-2026-0017', statut: 'Affecté', objet: 'Snapshot ERP avant patch',
      descriptionDetaillee: 'Besoin d’un snapshot erp-app-01 / erp-db-01 avant le patch constructeur.',
      categorie: 'VM', sousCategorie: 'Snapshot', impact: 'Faible', urgence: 'Élevée',
      assignedTeam: 'Système', assignedTo: selma?._id, ageHours: 9,
      specifications: { serveur: { vmCible: 'erp-app-01', nomSnapshot: 'pre-patch-2026-08' } },
    },
    {
      tenantId: fluidity._id, clientId: atlas._id, contrat: ctrAtlas._id, createdBy: atlas._id, createdByModel: 'Client',
      reference: 'INC-2026-0018', statut: "En cours d'analyse", objet: 'Job backup configuration à recréer',
      descriptionDetaillee: 'Le job quotidien a été supprimé par erreur. Recréer la configuration Veeam.',
      categorie: 'Sauvegarde', sousCategorie: 'Backup Configuration', impact: 'Élevé', urgence: 'Faible',
      assignedTeam: 'Cloud', assignedTo: lina?._id, ageHours: 11,
      specifications: { backup: { typeBackup: 'Incremental', frequenceSauvegarde: 'Quotidienne', systemeCible: 'VM-finances' } },
    },
  ];

  const novaTickets = [];
  if (novaRetail && ctrNova) {
    novaTickets.push(
      {
        tenantId: nova._id, clientId: novaRetail._id, contrat: ctrNova._id, createdBy: novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0101', statut: 'Nouveau', objet: 'Coupures réseau caisses Sfax',
        descriptionDetaillee: 'Microcoupures 2s toutes les 20 min sur le lien principal.',
        categorie: 'Réseau', sousCategorie: 'Routage', impact: 'Critique', urgence: 'Élevée', ageHours: 3,
        assignedTeam: '', assignedTo: null,
      },
      {
        tenantId: nova._id, clientId: novaRetail._id, contrat: ctrNova._id, createdBy: novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0102', statut: "En cours d'analyse", objet: 'VPN siège instable',
        descriptionDetaillee: 'Le tunnel IPsec tombe toutes les 2 heures.',
        categorie: 'Réseau', sousCategorie: 'VPN', impact: 'Élevé', urgence: 'Moyenne',
        assignedTeam: 'Réseau', assignedTo: dora?._id, ageHours: 14,
        specifications: { reseau: { typeVpn: 'IPSec', peerGateway: 'siege.nova.tn' } },
      },
      {
        tenantId: nova._id, clientId: novaLog?._id || novaRetail._id, contrat: ctrNovaLog?._id || ctrNova._id,
        createdBy: novaLog?._id || novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0103', statut: 'Résolu', objet: 'Extension RAM WMS appliquée',
        descriptionDetaillee: 'RAM de wms-app-01 passée à 32 Go. Client a 48h pour confirmer.',
        categorie: 'VM', sousCategorie: 'Extension ressources', impact: 'Moyen', urgence: 'Élevée',
        assignedTeam: 'Cloud', assignedTo: sami?._id, ageHours: 36,
        resolution: { resume: 'Hot-add RAM OK.', resolvedAt: hoursAgo(8), resolvedBy: sami?._id, resolvedByModel: 'Utilisateur' },
      },
      {
        tenantId: nova._id, clientId: novaRetail._id, contrat: ctrNova._id, createdBy: novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0104', statut: 'En attente client', objet: 'Préciser la fenêtre de restore ERP',
        descriptionDetaillee: 'Restore ERP demandé — en attente de la fenêtre validée par le métier.',
        categorie: 'Sauvegarde', sousCategorie: 'Restore', impact: 'Élevé', urgence: 'Faible',
        assignedTeam: 'Support N1', assignedTo: ines?._id, attenteMotif: 'Fenêtre de maintenance',
        attenteDepuis: hoursAgo(30), ageHours: 40,
      },
      {
        tenantId: nova._id, clientId: novaRetail._id, contrat: ctrNova._id, createdBy: novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0105', statut: 'Clôturé', objet: 'Certificat caisse renouvelé',
        descriptionDetaillee: 'Renouvellement SSL des terminaux caisse.',
        categorie: 'Sécurité', sousCategorie: 'Certificat', impact: 'Faible', urgence: 'Moyenne',
        assignedTeam: 'Support N1', assignedTo: ines?._id, ageHours: 200,
        resolution: { resume: 'Certificats déployés.', closedAt: hoursAgo(150), confirmationClient: true },
      },
      {
        tenantId: nova._id, clientId: novaRetail._id, contrat: ctrNova._id, createdBy: novaRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0106', statut: 'Affecté', objet: 'Load balancer VIP caisses timeout',
        descriptionDetaillee: 'Le VIP 10.70.0.10 ne répond plus sur 443. Health checks KO sur 2 backends.',
        categorie: 'Réseau', sousCategorie: 'Load Balancer', impact: 'Critique', urgence: 'Critique',
        assignedTeam: 'Réseau', assignedTo: dora?._id, ageHours: 4,
        specifications: { reseau: { typeLb: 'L7', vip: '10.70.0.10', portsLb: '443', healthCheck: 'HTTPS /health' } },
      }
    );
  }

  const carthageTickets = [];
  if (carthage && carthageRetail && ctrC) {
    carthageTickets.push(
      {
        tenantId: carthage._id, clientId: carthageRetail._id, contrat: ctrC._id, createdBy: carthageRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0201', statut: 'Nouveau', objet: 'WiFi magasin Lac 2 down',
        descriptionDetaillee: 'SSID magasin-lac2 introuvable.',
        categorie: 'Réseau', sousCategorie: 'WiFi', impact: 'Critique', urgence: 'Critique', ageHours: 1,
        assignedTeam: '', assignedTo: null,
        specifications: { reseau: { ssid: 'magasin-lac2' } },
      },
      {
        tenantId: carthage._id, clientId: carthageRetail._id, contrat: ctrC._id, createdBy: carthageRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0202', statut: 'Affecté', objet: 'VM caisse-db lente',
        descriptionDetaillee: 'Latence disque élevée sur caisse-db.',
        categorie: 'VM', sousCategorie: 'Extension ressources', impact: 'Élevé', urgence: 'Élevée',
        assignedTeam: 'Support N1', assignedTo: tarek?._id, ageHours: 6,
      },
      {
        tenantId: carthage._id, clientId: carthageRetail._id, contrat: ctrC._id, createdBy: carthageRetail._id, createdByModel: 'Client',
        reference: 'INC-2026-0203', statut: 'En cours de résolution', objet: 'SAN iSCSI timeouts',
        descriptionDetaillee: 'Timeouts iSCSI sur le volume caisses.',
        categorie: 'Stockage', sousCategorie: 'SAN', impact: 'Critique', urgence: 'Moyenne',
        assignedTeam: 'Système', assignedTo: aya?._id, ageHours: 9,
        specifications: { stockage: [{ typeStockage: 'SAN', protocole: 'iSCSI', capaciteGo: 500 }] },
      }
    );
  }

  const all = [...fluidityTickets, ...novaTickets, ...carthageTickets];
  let created = 0;
  const createdDocs = [];

  for (const raw of all) {
    const exists = await Ticket.findOne({ tenantId: raw.tenantId, reference: raw.reference });
    if (exists) continue;
    const doc = ticketDoc(raw);
    await doc.save();
    createdDocs.push(doc);
    created += 1;
    const year = 2026;
    const seq = Number(String(raw.reference).split('-').pop());
    await TicketSequence.findOneAndUpdate(
      { tenantId: raw.tenantId, year },
      { $max: { seq } },
      { upsert: true }
    );
  }

  // Commentaires + activités sur les tickets fraîchement créés
  let comments = 0;
  let activities = 0;
  for (const t of createdDocs) {
    await TicketActivity.create({
      tenantId: t.tenantId,
      ticketId: t._id,
      action: 'creation',
      visibilite: 'public',
      acteur: t.createdBy,
      acteurModel: 'Client',
      acteurEmail: 'seed',
      metadata: { reference: t.reference, priorite: t.priorite },
    });
    activities += 1;

    if (t.assignedTo) {
      await TicketActivity.create({
        tenantId: t.tenantId,
        ticketId: t._id,
        action: 'affectation',
        visibilite: 'public',
        acteur: t.assignedTo,
        acteurModel: 'Utilisateur',
        metadata: { equipe: t.assignedTeam },
      });
      activities += 1;
    }

    if (t.statut !== 'Nouveau') {
      await TicketActivity.create({
        tenantId: t.tenantId,
        ticketId: t._id,
        action: 'statut',
        visibilite: 'public',
        acteurModel: 'Systeme',
        acteurEmail: 'systeme',
        metadata: { de: 'Nouveau', vers: t.statut },
      });
      activities += 1;
    }

    await TicketComment.create({
      tenantId: t.tenantId,
      ticketId: t._id,
      visibilite: 'public',
      corps: `Bonjour, merci de traiter l’incident ${t.reference} en priorité ${t.priorite}.`,
      auteur: t.createdBy,
      auteurModel: 'Client',
    });
    comments += 1;

    if (t.assignedTo) {
      await TicketComment.create({
        tenantId: t.tenantId,
        ticketId: t._id,
        visibilite: 'interne',
        corps: 'Note interne : vérifier les logs avant d’escalader N2. Invisible au client.',
        auteur: t.assignedTo,
        auteurModel: 'Utilisateur',
      });
      comments += 1;
      await TicketActivity.create({
        tenantId: t.tenantId,
        ticketId: t._id,
        action: 'note_interne',
        visibilite: 'interne',
        acteur: t.assignedTo,
        acteurModel: 'Utilisateur',
        metadata: { extrait: 'Note interne N1/N2' },
      });
      activities += 1;
    }
  }

  console.log(
    created > 0
      ? `[Seed] Tickets : ${created} créé(s), ${comments} commentaire(s), ${activities} activité(s).`
      : '[Seed] Tickets de démonstration déjà présents — aucun ajout.'
  );
};

module.exports = { seedTickets };

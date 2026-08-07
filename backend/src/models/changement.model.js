const mongoose = require('mongoose');
const { Schema } = mongoose;

const { CHANGEMENT_STATUTS } = require('../utils/workflow');

/**
 * TypeChangement: 'Standard' | 'Majeur' | 'Urgent'
 * StatutChangement (cycle de vie complet, §2.3.4) :
 *   'Soumis' -> 'En attente de validation' -> 'Approuvé' -> 'Planifié'
 *   -> 'En cours d'implémentation' -> 'Implémenté' -> 'En revue post-implémentation'
 *   -> 'Clôturé' (+ 'Rollback' et 'Rejeté')
 */

const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;

const SpecificationsSchema = new Schema(
  {
    general: {
      ressourcesConcernees: { type: String },
      environnement: { type: String },
      commentaire: { type: String },
    },
    serveur: {
      os: { type: String },
      hostname: { type: String },
      cpuCores: { type: Number },
      ramGo: { type: Number },
      // Disques dynamiques : paires [capacité Go] + [type] (NVMe/SAS/SSD/HDD/SATA/Autre)
      disques: [
        new Schema(
          {
            capaciteGo: { type: Number, required: true },
            type: { type: String, required: true },
            typePrecision: { type: String }, // précision libre quand type = 'Autre'
          },
          { _id: false }
        ),
      ],
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String, match: [IPV4_REGEX, 'Adresse IP invalide (format IPv4 attendu)'] },
      masqueSousReseau: { type: String, match: [IPV4_REGEX, 'Masque de sous-réseau invalide (format IPv4 attendu)'] },
      passerelle: { type: String, match: [IPV4_REGEX, 'Passerelle invalide (format IPv4 attendu)'] },
      dnsPrimaire: { type: String, match: [IPV4_REGEX, 'DNS primaire invalide (format IPv4 attendu)'] },
      dnsSecondaire: { type: String, match: [IPV4_REGEX, 'DNS secondaire invalide (format IPv4 attendu)'] },
      routage: { type: String }, // Statique, OSPF, BGP...
    },
    // Section dédiée pare-feu / VPN (combinaisons Réseau+VPN et
    // Sécurité+Firewall — voir SECTIONS_SPECIFICATIONS côté frontend)
    firewall: {
      reglesPareFeu: { type: String }, // une règle par ligne
      ports: { type: String },
      nat: { type: String },
      zones: { type: String },
      politique: { type: String },
      vpn: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String }, // « <nombre> <période> » validé par Zod (plages par période)
      frequenceSauvegarde: { type: String },
      destinationBackup: { type: String },
      compression: { type: String }, // 'Oui' | 'Non'
      chiffrement: { type: String }, // 'Oui' | 'Non'
      licencesNecessaires: { type: String },
    },
    // Sections additionnelles, affichées côté formulaire selon la catégorie
    // sélectionnée (miroir du schéma Zod et des FormGroups Angular).
    baseDeDonnees: {
      moteur: { type: String }, // SQL Server, PostgreSQL, MySQL, Oracle, MongoDB...
      version: { type: String },
      tailleGo: { type: Number },
    },
    stockage: {
      typeStockage: { type: String },
      capaciteGo: { type: Number },
      protocole: { type: String }, // NFS, SMB, iSCSI...
    },
    portailWeb: {
      domaine: { type: String },
      sslRequis: { type: String }, // 'Oui' | 'Non'
      technologie: { type: String },
    },
    conteneurs: {
      plateforme: { type: String }, // Docker, Kubernetes...
      nombreReplicas: { type: Number },
      cpuAlloue: { type: String },
      memoireAllouee: { type: String },
    },
    iaGpu: {
      typeGpu: { type: String }, // NVIDIA A100, H100...
      nombreGpu: { type: Number },
      vramGo: { type: Number }, // mémoire vidéo par GPU
      framework: { type: String }, // PyTorch, TensorFlow, ONNX, Hugging Face, CUDA...
      versionCuda: { type: String },
      versionPilote: { type: String },
    },
    securite: {
      perimetre: { type: String },
      niveauCriticite: { type: String }, // Standard, Élevé, Critique...
    },
  },
  { _id: false }
);

const ChangementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // Compte utilisateur (CLIENT) qui a soumis le changement — normalisation ObjectId
    requester: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    objetChangement: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    // NB : la « fenêtre d'intervention souhaitée » n'est plus collectée (formulaire simplifié).
    // Les documents existants conservent leur champ fenetreIntervention historique s'il existe.
    prerequisNecessaires: { type: String },
    planRetourArriere: { type: String, required: true },
    contrat: { type: Schema.Types.ObjectId, ref: 'Contrat', required: true },
    piecesJointes: [{ type: String }],
    typeChangement: {
      type: String,
      enum: ['Standard', 'Majeur', 'Urgent'],
      required: true,
    },
    statut: { type: String, enum: CHANGEMENT_STATUTS, default: 'Soumis' },
    specifications: { type: SpecificationsSchema, default: {} },
  },
  { timestamps: true }
);

ChangementSchema.index({ tenantId: 1, createdAt: -1 });
ChangementSchema.index({ tenantId: 1, requester: 1 });

const Changement = mongoose.model('Changement', ChangementSchema);

module.exports = { Changement };

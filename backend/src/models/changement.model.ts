import mongoose, { Schema, Document } from 'mongoose';

export type TypeChangement = 'Normal' | 'Majeur' | 'Urgent';

export type StatutChangement =
  | 'Soumis'
  | 'En revue'
  | 'Approuvé'
  | 'Rejeté'
  | 'En cours'
  | 'Clôturé';

export interface ISpecifications {
  general?: {
    ressourcesConcernees?: string;
    environnement?: string;
    commentaire?: string;
  };
  serveur?: {
    os?: string;
    cpuCores?: number;
    ramGo?: number;
    disqueNvmeGo?: number;
    disqueSasGo?: number;
  };
  reseau?: {
    vlan?: string;
    adresseIp?: string;
    masqueSousReseau?: string;
    passerelle?: string;
  };
  backup?: {
    espaceBackupSupplementaireGo?: number;
    retentionSouhaitee?: string;
    licencesNecessaires?: string;
  };
}

/**
 * Interface du document Changement (infrastructure change).
 */
export interface IChangement extends Document {
  tenantId: string;
  clientId: string;
  objetChangement: string;
  descriptionDetaillee: string;
  serviceEnvironnement: string;
  categorie: string;
  sousCategorie: string;
  fenetreIntervention: Date;
  prerequisNecessaires?: string;
  planRetourArriere: string;
  typeChangement: TypeChangement;
  statut: StatutChangement;
  specifications: ISpecifications;
  createdAt: Date;
  updatedAt: Date;
}

const SpecificationsSchema = new Schema(
  {
    general: {
      ressourcesConcernees: { type: String },
      environnement: { type: String },
      commentaire: { type: String },
    },
    serveur: {
      os: { type: String },
      cpuCores: { type: Number },
      ramGo: { type: Number },
      disqueNvmeGo: { type: Number },
      disqueSasGo: { type: Number },
    },
    reseau: {
      vlan: { type: String },
      adresseIp: { type: String },
      masqueSousReseau: { type: String },
      passerelle: { type: String },
    },
    backup: {
      espaceBackupSupplementaireGo: { type: Number },
      retentionSouhaitee: { type: String },
      licencesNecessaires: { type: String },
    },
  },
  { _id: false }
);

const ChangementSchema = new Schema<IChangement>(
  {
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    objetChangement: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    fenetreIntervention: { type: Date, required: true },
    prerequisNecessaires: { type: String },
    planRetourArriere: { type: String, required: true },
    typeChangement: {
      type: String,
      enum: ['Normal', 'Majeur', 'Urgent'],
      required: true,
    },
    statut: { type: String, default: 'Soumis' },
    specifications: { type: SpecificationsSchema, default: {} },
  },
  { timestamps: true }
);

ChangementSchema.index({ tenantId: 1, createdAt: -1 });

export const Changement = mongoose.model<IChangement>(
  'Changement',
  ChangementSchema
);

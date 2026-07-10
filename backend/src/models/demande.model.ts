import mongoose, { Schema, Document } from 'mongoose';

export type PrioriteDemande = 'Standard' | 'Élevée' | 'Urgente';

export type StatutDemande =
  | 'Ouverte'
  | 'En cours d\'analyse'
  | 'En cours de traitement'
  | 'Résolue'
  | 'Fermée'
  | 'Rejetée';

/**
 * Interface du document Demande (service request).
 */
export interface IDemande extends Document {
  tenantId: string;
  clientId: string;
  objet: string;
  typeDemande: string;
  serviceEnvironnement: string;
  categorie: string;
  sousCategorie: string;
  descriptionDetaillee: string;
  prioriteSouhaitee: PrioriteDemande;
  dateSouhaiteeRealisation?: Date;
  informationsComplementaires?: string;
  contrat: string;
  piecesJointes: string[];
  statut: StatutDemande;
  createdAt: Date;
  updatedAt: Date;
}

const DemandeSchema = new Schema<IDemande>(
  {
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    objet: { type: String, required: true },
    typeDemande: { type: String, required: true },
    serviceEnvironnement: { type: String, required: true },
    categorie: { type: String, required: true },
    sousCategorie: { type: String, required: true },
    descriptionDetaillee: { type: String, required: true },
    prioriteSouhaitee: {
      type: String,
      enum: ['Standard', 'Élevée', 'Urgente'],
      required: true,
    },
    dateSouhaiteeRealisation: { type: Date },
    informationsComplementaires: { type: String },
    contrat: { type: String, required: true },
    piecesJointes: [{ type: String }],
    statut: { type: String, default: 'Ouverte' },
  },
  { timestamps: true }
);

// Index pour isoler les requêtes par tenant
DemandeSchema.index({ tenantId: 1, createdAt: -1 });

export const Demande = mongoose.model<IDemande>('Demande', DemandeSchema);

export type StatutContrat = 'Actif' | 'Expiré' | 'Suspendu';

/** Référence peuplée côté serveur : la fiche client rattachée au contrat. */
export interface ClientRef {
  _id: string;
  nom: string;
  email?: string;
  statut?: string;
}

export interface Contrat {
  _id?: string;
  tenantId?: string;
  /** Client du contrat — ObjectId en écriture, peuplé en lecture (nom, email, statut). */
  clientId: string | ClientRef;
  reference: string;
  intitule: string;
  typeContrat?: string;
  statut?: StatutContrat;
  dateDebut: string;
  dateFin?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUTS_CONTRAT: StatutContrat[] = ['Actif', 'Expiré', 'Suspendu'];

export const TYPES_CONTRAT: string[] = [
  'Support',
  'Hébergement',
  'Infogérance',
  'Sécurité',
  'Développement',
  'Autre',
];

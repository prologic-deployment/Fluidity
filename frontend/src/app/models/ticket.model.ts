import { ContratRef, RequesterRef } from './demande.model';

export type TypeTicket = 'Incident';
export type ImpactTicket = 'Faible' | 'Moyen' | 'Élevé' | 'Critique';
export type UrgenceTicket = 'Faible' | 'Moyenne' | 'Élevée' | 'Critique';
export type PrioriteTicket = 'P1' | 'P2' | 'P3' | 'P4';

export type StatutTicket =
  | 'Nouveau'
  | 'Affecté'
  | "En cours d'analyse"
  | 'En attente client'
  | 'En attente tiers'
  | 'En cours de résolution'
  | 'Résolu'
  | 'Clôturé'
  | 'Réouvert';

export interface TicketDiagnostic {
  source?: string;
  destination?: string;
  protocole?: string;
  port?: string;
  direction?: string;
  comportement?: string;
  nomVm?: string;
  environnement?: string;
  hote?: string;
  ip?: string;
  systemeStockage?: string;
  volume?: string;
  capacite?: string;
  systemeAffecte?: string;
  evenementSecurite?: string;
  heureDetection?: string;
}

export interface TicketSla {
  reponseHeures?: number;
  resolutionHeures?: number;
  reponseDueAt?: string;
  resolutionDueAt?: string;
  respondedAt?: string;
  pausedAt?: string;
  pausedMs?: number;
  breached?: boolean;
}

export interface TicketSlaEtat {
  code: 'ok' | 'paused' | 'at_risk' | 'breached' | 'inconnu';
  label: string;
}

export interface TicketResolution {
  resume?: string;
  actionCorrective?: string;
  workaround?: string;
  resolvedAt?: string;
  confirmationClient?: boolean;
  confirmationAt?: string;
  closedAt?: string;
  closedReason?: string;
}

export interface Ticket {
  _id?: string;
  clientId?: RequesterRef | string;
  contrat: string | ContratRef;
  createdBy?: RequesterRef | string;
  reference?: string;
  /** Toujours « Incident » — fixé côté serveur, jamais saisi. */
  type?: TypeTicket;
  objet: string;
  descriptionDetaillee: string;
  openedAt?: string;
  categorie: string;
  sousCategorie: string;
  impact: ImpactTicket;
  urgence: UrgenceTicket;
  priorite?: PrioriteTicket;
  statut?: StatutTicket;
  assignedTeam?: string;
  assignedTo?: { _id: string; email: string; firstName?: string; lastName?: string; role?: string } | string | null;
  piecesJointes?: string[];
  diagnostic?: TicketDiagnostic;
  specifications?: Record<string, any>;
  attenteMotif?: string;
  attenteDepuis?: string;
  sla?: TicketSla;
  slaEtat?: TicketSlaEtat;
  resolution?: TicketResolution;
  transitionsAutorisees?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pages: number;
}

export interface TicketStats {
  total: number;
  nouveaux: number;
  affectes: number;
  enAnalyse: number;
  enResolution: number;
  enAttente: number;
  resolus: number;
  clotures: number;
  ouverts: number;
  p1p2: number;
  attenteClient: number;
  attenteTiers: number;
  mesAssignes: number;
  resolus7j: number;
}

/** Auteur peuplé côté serveur (compte Utilisateur). */
export interface TicketCommentAuteur {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface TicketComment {
  _id: string;
  visibilite: 'public' | 'interne';
  corps: string;
  /** ObjectId en base, peuplé en objet { email, firstName, lastName, role } à la lecture. */
  auteur: TicketCommentAuteur | string;
  piecesJointes?: string[];
  createdAt: string;
}

export interface TicketActivity {
  _id: string;
  action: string;
  visibilite: 'public' | 'interne';
  acteurEmail?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const TYPES_TICKET: TypeTicket[] = ['Incident'];
export const IMPACTS_TICKET: ImpactTicket[] = ['Faible', 'Moyen', 'Élevé', 'Critique'];
export const URGENCES_TICKET: UrgenceTicket[] = ['Faible', 'Moyenne', 'Élevée', 'Critique'];
export const STATUTS_TICKET: StatutTicket[] = [
  'Nouveau',
  'Affecté',
  "En cours d'analyse",
  'En attente client',
  'En attente tiers',
  'En cours de résolution',
  'Résolu',
  'Clôturé',
  'Réouvert',
];

export const EQUIPES_SUPPORT: string[] = [
  'Support N1',
  'Système',
  'Cloud',
  'Réseau',
  'Sécurité',
  'Stockage',
  'Autre',
];

/** @deprecated utiliser CATEGORIES / SOUS_CATEGORIES (demande.model) — source unique. */

const PRIORITY_MATRIX: Record<ImpactTicket, Record<UrgenceTicket, PrioriteTicket>> = {
  Faible: { Faible: 'P4', Moyenne: 'P4', Élevée: 'P3', Critique: 'P3' },
  Moyen: { Faible: 'P4', Moyenne: 'P3', Élevée: 'P3', Critique: 'P2' },
  Élevé: { Faible: 'P3', Moyenne: 'P3', Élevée: 'P2', Critique: 'P1' },
  Critique: { Faible: 'P3', Moyenne: 'P2', Élevée: 'P1', Critique: 'P1' },
};

export function calculatePriority(impact: ImpactTicket | '', urgence: UrgenceTicket | ''): PrioriteTicket | null {
  if (!impact || !urgence) return null;
  return PRIORITY_MATRIX[impact]?.[urgence] ?? null;
}

export function champsDiagnostic(categorie: string | null | undefined): string[] {
  switch (categorie) {
    case 'Réseau':
      return ['source', 'destination', 'protocole', 'port', 'direction', 'comportement'];
    case 'VM':
    case 'Infrastructure':
      return ['nomVm', 'environnement', 'hote', 'ip', 'comportement'];
    case 'Stockage':
      return ['systemeStockage', 'volume', 'capacite', 'protocole', 'comportement'];
    case 'Sécurité':
      return ['systemeAffecte', 'evenementSecurite', 'heureDetection', 'comportement'];
    default:
      return ['comportement'];
  }
}

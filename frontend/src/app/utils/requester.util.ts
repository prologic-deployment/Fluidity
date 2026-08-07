import { RequesterRef, RequesterClientRef } from '../models/demande.model';

export type { RequesterRef, RequesterClientRef };

/**
 * Accesseurs d'affichage partagés pour le « demandeur » d'un dossier
 * (Demandes & Changements) — source unique utilisée par les deux tableaux
 * de bord (colonne Client, recherche, tri, modales de détail).
 */

/** Email du compte demandeur (référence ObjectId peuplée ou chaîne brute). */
export function requesterEmail(requester: RequesterRef | string | undefined): string {
  if (requester && typeof requester === 'object') return requester.email;
  return (requester as string) || '—';
}

/** Fiche société cliente rattachée, si peuplée côté serveur. */
export function requesterClientFiche(requester: RequesterRef | string | undefined): RequesterClientRef | null {
  if (requester && typeof requester === 'object' && requester.clientId && typeof requester.clientId === 'object') {
    return requester.clientId as RequesterClientRef;
  }
  return null;
}

/**
 * Nom du CLIENT à afficher (colonne « Client », tri, recherche, détail) :
 * raison sociale de la fiche rattachée si disponible, sinon nom propre du
 * principal, sinon prénom + nom, sinon identifiant de l'email.
 */
export function requesterClientNom(requester: RequesterRef | string | undefined): string {
  if (!requester || typeof requester !== 'object') return '—';
  const fiche = requesterClientFiche(requester);
  if (fiche?.nom) return fiche.nom;
  if (requester.nom) return requester.nom;
  const identite = [requester.firstName, requester.lastName].filter(Boolean).join(' ').trim();
  if (identite) return identite;
  return requester.email ? requester.email.split('@')[0] : '—';
}

/** Nom de fichier déduit d'une URL de pièce jointe (affichage lisible). */
export function nomFichierDepuisUrl(url: string): string {
  try {
    const segment = String(url).split('?')[0].split('/').filter(Boolean).pop() || 'fichier';
    return decodeURIComponent(segment);
  } catch {
    return 'fichier';
  }
}

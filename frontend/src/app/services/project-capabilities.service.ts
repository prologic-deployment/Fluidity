import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ProjectCapabilities } from '../models/project.model';
import { ProjectService } from './project.service';

/** Vrai si la permission produit est accordée (gère le joker administrateur `*`). */
export function hasProjectPermission(caps: ProjectCapabilities | null, permission: string): boolean {
  if (!caps) return false;
  const perms = caps.permissions || [];
  return perms.includes('*') || perms.includes(permission);
}

/**
 * Capacités effectives du projet courant, chargées une seule fois par
 * projet (cache + partage). Les composants en dérivent l'affichage des
 * onglets et boutons ; le serveur reste l'autorité (chaque action est
 * re-vérifiée côté backend).
 */
@Injectable({ providedIn: 'root' })
export class ProjectCapabilitiesService {
  private readonly cache = new Map<string, Observable<ProjectCapabilities>>();

  constructor(private api: ProjectService) {}

  forProject(projectId: string): Observable<ProjectCapabilities> {
    let shared = this.cache.get(projectId);
    if (!shared) {
      shared = this.api.capabilities(projectId).pipe(shareReplay(1));
      this.cache.set(projectId, shared);
    }
    return shared;
  }

  clear(projectId?: string): void {
    if (projectId) this.cache.delete(projectId);
    else this.cache.clear();
  }
}

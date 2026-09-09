import { Injectable } from '@angular/core';

/**
 * Libellés DYNAMIQUES de fil d'Ariane : les pages de détail enregistrent un
 * libellé lisible (nom du projet, référence de tâche…) pour leur URL — le
 * BreadcrumbComponent substitue ainsi les jetons « :param » par des valeurs
 * humaines, JAMAIS par des ObjectId bruts.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly labels = new Map<string, string>();

  /** Enregistre (ou remplace) le libellé d'une URL complète (ex. /projets/<id>). */
  setLabel(url: string, label: string): void {
    this.labels.set(this.normalize(url), label);
  }

  /** Supprime le libellé d'une URL (navigation ailleurs, composant détruit). */
  clearLabel(url: string): void {
    this.labels.delete(this.normalize(url));
  }

  /** Libellé enregistré pour l'URL, ou null. */
  labelFor(url: string): string | null {
    return this.labels.get(this.normalize(url)) ?? null;
  }

  private normalize(url: string): string {
    return url.endsWith('/') && url.length > 1 ? url.slice(0, -1) : url;
  }
}

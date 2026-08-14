import { Injectable } from '@angular/core';

/**
 * SEO minimal pour les pages publiques : title + meta description.
 * Le contenu essentiel n'est jamais contenu uniquement dans le WebGL :
 * les pages embarquent du HTML crawlable (sections, textes, FAQ).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  setTitle(title: string): void {
    document.title = title;
  }

  setDescription(description: string): void {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }

  setPage(title: string, description: string): void {
    this.setTitle(title);
    this.setDescription(description);
  }
}

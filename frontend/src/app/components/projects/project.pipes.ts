import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../i18n/i18n.service';
import { ActivityEntry, WorkflowState } from '../../models/project.model';

const SYSTEM_PREFIX = 'products.workflows.project_management.states.';

/**
 * Libellé d'un ÉTAT de workflow de projet :
 *  - état système (backlog, todo, …) → clé i18n du catalogue produit ;
 *  - état PERSONNALISÉ du projet → libellé saisi par l'utilisateur (tel quel,
 *    jamais une clé brute) ;
 *  - chaîne seule → clé système (repli sûr).
 */
@Pipe({ name: 'pState', standalone: true, pure: false })
export class ProjectStatePipe implements PipeTransform, OnDestroy {
  private sub: Subscription;

  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }

  transform(value: WorkflowState | string | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') return this.i18n.t(SYSTEM_PREFIX + value);
    if (value.label) return value.label;
    return this.i18n.t(SYSTEM_PREFIX + value.key);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

/** Couleur (classe CSS) d'un état : couleur personnalisée ou défaut système. */
@Pipe({ name: 'pStateDot', standalone: true, pure: true })
export class ProjectStateDotPipe implements PipeTransform {
  transform(value: WorkflowState | string | null | undefined): string {
    const colors: Record<string, string> = {
      backlog: 'bg-slate-400',
      todo: 'bg-sky-500',
      in_progress: 'bg-indigo-500',
      blocked: 'bg-red-500',
      review: 'bg-amber-500',
      completed: 'bg-emerald-500',
      cancelled: 'bg-slate-500',
    };
    const key = typeof value === 'string' ? value : value?.key || '';
    return colors[key] || 'bg-violet-500';
  }
}

/**
 * Phrase d'ACTIVITÉ projet traduite : « a affecté TSK-003 à Dora Net » —
 * l'entrée d'activité porte une clé i18n + des paramètres structurés
 * (jamais de phrase pré-formatée en base, jamais [object Object]).
 */
@Pipe({ name: 'pActivity', standalone: true, pure: false })
export class ProjectActivityPipe implements PipeTransform, OnDestroy {
  private sub: Subscription;

  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }

  transform(entry: ActivityEntry | null | undefined): string {
    if (!entry) return '';
    const actor = entry.actorId
      ? `${entry.actorId.firstName || ''} ${entry.actorId.lastName || ''}`.trim()
      : '';
    const params: Record<string, string | number> = {
      ...(entry.metadata as Record<string, string | number> | undefined || {}),
      actor,
    };
    // Nettoyage : aucune valeur objet ne doit atteindre l'interpolation.
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && typeof v === 'object') params[k] = '';
    }
    return this.i18n.t(entry.action, params);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

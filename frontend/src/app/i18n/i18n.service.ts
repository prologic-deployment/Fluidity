import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FR } from './fr';
import { EN } from './en';

export type AppLang = 'fr' | 'en';

const STORAGE_KEY = 'fluidity_lang';
const DICTS: Record<AppLang, Record<string, unknown>> = { fr: FR, en: EN };

/**
 * Locale BCP-47 associée à chaque langue d'interface — utilisée pour le
 * formatage des dates et des nombres (Intl) et pour le pipe `date` d'Angular.
 * Le stockage reste inchangé : seule la présentation est localisée.
 */
export const LANG_LOCALES: Record<AppLang, string> = { fr: 'fr-FR', en: 'en-GB' };

/**
 * Résolution d'une clé de traduction.
 *
 * Les dictionnaires FR/EN utilisent DEUX styles de clés :
 *   1. objets imbriqués  → `common: { save: '…' }` (clé « common.save ») ;
 *   2. clés plates       → `'products.servicedesk.name': '…'`
 *      (clé « products.servicedesk.name » avec points DANS la clé) ;
 *   3. mixte             → `audit: { platform: { 'subscription.created': '…' } }`
 *      (suffixe plat sous un objet imbriqué).
 *
 * On tente : correspondance exacte (clé plate), puis, à chaque niveau de la
 * descente, le suffixe restant comme clé plate, puis le segment suivant.
 */
function lookup(dict: Record<string, unknown>, path: string): string | undefined {
  // 1) Clé plate : correspondance exacte sur la chaîne complète.
  const direct = dict[path];
  if (typeof direct === 'string') return direct;
  // 2) Descente dans les objets imbriqués, en testant à chaque niveau le
  //    suffixe restant comme clé plate (style mixte).
  const parts = path.split('.');
  let cur: unknown = dict;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const remaining = parts.slice(i).join('.');
    if (remaining !== path) {
      const hit = (cur as Record<string, unknown>)[remaining];
      if (typeof hit === 'string') return hit;
    }
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  return typeof cur === 'string' ? cur : undefined;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly langSubject: BehaviorSubject<AppLang>;
  readonly lang$: import('rxjs').Observable<AppLang>;

  constructor() {
    const initial = this.readInitial();
    this.langSubject = new BehaviorSubject<AppLang>(initial);
    this.lang$ = this.langSubject.asObservable();
    if (typeof document !== 'undefined') document.documentElement.lang = initial;
  }

  get lang(): AppLang {
    return this.langSubject.value;
  }

  /** Locale BCP-47 courante pour le formatage dates/nombres. */
  get locale(): string {
    return LANG_LOCALES[this.lang];
  }

  setLang(lang: AppLang): void {
    if (lang !== 'fr' && lang !== 'en') return;
    localStorage.setItem(STORAGE_KEY, lang);
    this.langSubject.next(lang);
    document.documentElement.lang = lang;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const primary = lookup(DICTS[this.lang], key);
    const fallback = this.lang === 'fr' ? lookup(DICTS.en, key) : lookup(DICTS.fr, key);
    let out = primary ?? fallback ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v));
      }
    }
    return out;
  }

  /** Libellé d'une valeur stockée (statut, catégorie, rôle…). */
  label(value: string | null | undefined, prefix = 'catalog'): string {
    if (!value) return '';
    return this.t(`${prefix}.${value}`);
  }

  /**
   * Formate une date avec la locale courante. Retourne '' si la valeur est
   * invalide. Les valeurs stockées restent des ISO/Date MongoDB — jamais
   * modifiées par l'affichage.
   */
  formatDate(value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const opts: Intl.DateTimeFormatOptions =
      options ?? { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Intl.DateTimeFormat(this.locale, opts).format(d);
  }

  /**
   * Formate un nombre avec la locale courante (séparateur de milliers,
   * décimales…). La valeur stockée reste inchangée.
   */
  formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat(this.locale, options).format(value);
  }

  private readInitial(): AppLang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'fr') return stored;
    } catch {
      /* ignore */
    }
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'fr';
    return nav.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
}

import { Injectable } from '@angular/core';

/**
 * Listes de suggestions persistées (localStorage) pour les champs à
 * autocomplétion des rôles et des permissions.
 *
 * Toute valeur saisie par l'utilisateur (rôle ou permission) est mémorisée
 * et proposée à nouveau lors des prochaines utilisations.
 */
@Injectable({ providedIn: 'root' })
export class AutocompleteListService {
  private static readonly ROLES_KEY = 'fluidity.ac.roles.v1';
  private static readonly PERMS_KEY = 'fluidity.ac.permissions.v1';
  private static readonly MAX = 200;
  /** Suggestions initiales de clés de rôle. */
  private static readonly DEFAULT_ROLES = ['admin', 'manager', 'member', 'viewer'];

  private rolesCache: string[] | null = null;
  private permsCache: string[] | null = null;

  private load(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr: unknown = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];
    } catch {
      return [];
    }
  }

  private save(key: string, values: string[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(values.slice(0, AutocompleteListService.MAX)));
    } catch {
      /* stockage indisponible — suggestions en mémoire uniquement */
    }
  }

  /** Suggestions de clés de rôle : défauts + valeurs mémorisées. */
  roleSuggestions(): string[] {
    if (!this.rolesCache) {
      this.rolesCache = [...AutocompleteListService.DEFAULT_ROLES, ...this.load(AutocompleteListService.ROLES_KEY)];
    }
    return [...this.rolesCache];
  }

  /** Suggestions de permissions : valeurs mémorisées. */
  permissionSuggestions(): string[] {
    if (!this.permsCache) this.permsCache = this.load(AutocompleteListService.PERMS_KEY);
    return [...this.permsCache];
  }

  /** Mémorise une clé de rôle saisie par l'utilisateur. */
  rememberRole(value: string): void {
    const v = (value || '').trim();
    if (!v) return;
    const current = this.roleSuggestions();
    if (current.includes(v)) return;
    this.rolesCache = [...current, v];
    this.save(
      AutocompleteListService.ROLES_KEY,
      this.rolesCache.filter((x) => !AutocompleteListService.DEFAULT_ROLES.includes(x))
    );
  }

  /** Mémorise une permission saisie ou choisie par l'utilisateur. */
  rememberPermission(value: string): void {
    const v = (value || '').trim();
    if (!v) return;
    const current = this.permissionSuggestions();
    if (current.includes(v)) return;
    this.permsCache = [...current, v];
    this.save(AutocompleteListService.PERMS_KEY, this.permsCache);
  }
}

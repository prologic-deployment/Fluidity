/** Enveloppe paginée renvoyée par les listes API (PERF-002). */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

/** Paramètres de requête des listes paginées. */
export interface PageQuery {
  page?: number;
  limit?: number;
  [cle: string]: string | number | boolean | undefined;
}

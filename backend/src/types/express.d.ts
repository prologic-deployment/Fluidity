/**
 * Déclarations de types globales pour étendre l'objet Request d'Express
 * avec les propriétés injectées par le middleware d'authentification.
 */
declare global {
  namespace Express {
    interface Request {
      /** Identifiant du tenant, extrait du JWT. */
      tenantId?: string;
      /** Identifiant de l'utilisateur, extrait du JWT. */
      userId?: string;
      /** Rôle de l'utilisateur, extrait du JWT. */
      userRole?: string;
    }
  }
}

export {};

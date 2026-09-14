import { I18nService } from '../i18n/i18n.service';

/**
 * Codes d'erreur API stables émis par le backend (champ `code` de la réponse
 * JSON). La traduction appartient au frontend — jamais à l'API.
 */
const CODE_KEYS: Record<string, string> = {
  EMAIL_TAKEN: 'errors.emailTaken',
  TENANT_INVALID: 'errors.tenantInvalid',
  TENANT_NOT_FOUND: 'errors.tenantNotFound',
  TENANT_SUSPENDED: 'errors.tenantSuspended',
  TENANT_ARCHIVED: 'errors.tenantArchived',
  COMPTE_VERROUILLE: 'errors.accountLocked',
  MULTIPLE_WORKSPACES: 'errors.multipleWorkspaces',
  MOT_DE_PASSE_PROVISOIRE: 'errors.provisionalPassword',
  MOT_DE_PASSE_INVALIDE: 'security.currentPwdInvalid',
  SESSION_EXPIREE: 'errors.sessionExpired',
  SESSION_REVOQUEE: 'errors.sessionRevoked',
  LICENSE_REQUIRED: 'errors.licenseRequired',
  LICENSE_NOT_ASSIGNED: 'errors.licenseRequired',
  PRODUCT_NOT_AVAILABLE: 'errors.productUnavailable',
  PRODUCT_NOT_ACCESSIBLE: 'errors.productUnavailable',
  ALREADY_SUBSCRIBED: 'errors.alreadySubscribed',
  DUPLICATE_PENDING_ORDER: 'errors.pendingOrderExists',
  PASSWORD_BREACHED: 'errors.passwordBreached',
  TROP_DE_REQUETES: 'errors.tooManyRequests',
  QUOTA_STOCKAGE_ATTEINT: 'errors.storageQuota',
  PERMISSION_DENIED: 'errors.forbidden',
  PROJECT_FORBIDDEN: 'errors.forbidden',
  TYPE_INTERDIT: 'errors.forbidden',
  ROLE_LECTURE_SEULE: 'errors.forbidden',
  CROSS_TENANT_ROLE: 'errors.forbidden',
  CROSS_TENANT_LICENSE: 'errors.forbidden',
  CROSS_TENANT_MEMBER: 'errors.forbidden',
  INVALID_CREDENTIALS: 'auth.invalid',
  ACCOUNT_INACTIVE: 'errors.accountInactive',
  ACCOUNT_SUSPENDED: 'errors.accountSuspended',
  LEGACY_DATA: 'errors.legacyData',
  RESET_TOKEN_INVALID: 'errors.resetTokenInvalid',
  CLIENT_NOT_FOUND: 'errors.notFound',
  USER_NOT_FOUND: 'errors.notFound',
  CURRENT_PASSWORD_INVALID: 'security.currentPwdInvalid',
  PASSWORD_SAME: 'security.pwdSame',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  VALIDATION: 'errors.validation',
};

/**
 * Résout un message d'erreur API en tenant compte de la langue courante :
 *   1. code connu → traduction localisée (prioritaire, stable) ;
 *   2. pas de code et langue FR → message backend (les messages du backend
 *      sont en français) ;
 *   3. sinon → clé de repli traduite du composant.
 *
 * Les valeurs API (codes) ne sont jamais modifiées : seule la présentation
 * est localisée.
 */
export function apiErrorMessage(i18n: I18nService, err: unknown, fallbackKey: string): string {
  const body = (err as { error?: { code?: string; message?: string } })?.error;
  if (body?.code && CODE_KEYS[body.code]) {
    return i18n.t(CODE_KEYS[body.code]);
  }
  if (body?.message && i18n.lang === 'fr') {
    return body.message;
  }
  return i18n.t(fallbackKey);
}

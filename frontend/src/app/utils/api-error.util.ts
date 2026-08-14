import { I18nService } from '../i18n/i18n.service';

/**
 * Codes d'erreur API stables émis par le backend (champ `code` de la réponse
 * JSON). La traduction appartient au frontend — jamais à l'API.
 */
const CODE_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: 'auth.invalid',
  EMAIL_TAKEN: 'errors.emailTaken',
  TENANT_INVALID: 'errors.tenantInvalid',
  TENANT_NOT_FOUND: 'errors.tenantNotFound',
  TENANT_SUSPENDED: 'errors.tenantSuspended',
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

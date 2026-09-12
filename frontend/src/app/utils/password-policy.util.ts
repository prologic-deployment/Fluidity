import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Politique de mot de passe — miroir EXACT de la règle serveur
 * (`backend/src/utils/password.util.js`, AUTH-005 audit) :
 *   - 12 caractères minimum (128 maximum),
 *   - au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial.
 * Centralisée ici pour que les formulaires affichent la même exigence que
 * celle appliquée par l'API (jamais de validation divergente client/serveur).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function verifPolitiqueMotDePasse(valeur: string): string | null {
  const s = String(valeur || '');
  if (s.length < PASSWORD_MIN_LENGTH) return 'length';
  if (s.length > PASSWORD_MAX_LENGTH) return 'length';
  if (!/[A-Z]/.test(s)) return 'classes';
  if (!/[a-z]/.test(s)) return 'classes';
  if (!/[0-9]/.test(s)) return 'classes';
  if (!/[^A-Za-z0-9]/.test(s)) return 'classes';
  return null;
}

/** Validateur Angular — erreur `motDePasseFaible: { raison }`. */
export function motDePasseFortValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // `required` gère le vide
    const raison = verifPolitiqueMotDePasse(control.value);
    return raison ? { motDePasseFaible: { raison } } : null;
  };
}

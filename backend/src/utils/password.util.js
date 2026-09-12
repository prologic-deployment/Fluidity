const { randomInt } = require('crypto');

/**
 * Génération de mots de passe provisoires (accès portail clients).
 *
 * Exigences sécurité & usage :
 *   - aléa CRYPTOGRAPHIQUEMENT SÛR : crypto.randomInt (jamais Math.random,
 *     non adapté à un secret — prédictible) ;
 *   - longueur 14 caractères, 4 classes garanties (≥ 2 majuscules,
 *     ≥ 2 minuscules, ≥ 2 chiffres, ≥ 2 symboles) ;
 *   - alphabets DÉSAMBIGUÏSÉS : 0/O, 1/l/I exclus (les identifiants sont
 *     recopiés à la main dans la modale « affichée une seule fois ») ;
 *   - mélange Fisher-Yates à aléa sûr : les classes garanties ne restent
 *     JAMAIS en tête du mot de passe (sinon la structure filtrerait).
 *
 * Le provisoire n'est valable que jusqu'au premier changement :
 * `mustChangePassword` force son remplacement à la première connexion.
 */

// Alphabets sans caractères ambigus (0/O, 1/l/I, accents).
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULES = 'abcdefghijkmnopqrstuvwxyz';
const CHIFFRES = '23456789';
const SYMBOLES = '!#$%&*+-=?@';

/** Tire `n` caractères d'un alphabet via le GNA cryptographique du runtime. */
const tirer = (alphabet, n) => {
  let sortie = '';
  for (let i = 0; i < n; i += 1) sortie += alphabet[randomInt(alphabet.length)];
  return sortie;
};

/** Mélange Fisher-Yates — aléa cryptographique, en place sur un tableau. */
const melanger = (caracteres) => {
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres;
};

/**
 * Mot de passe provisoire : 14 caractères, 4 classes garanties, mélangé.
 * @returns {string} en clair — à transmettre UNE SEULE FOIS (affichage
 *   modale) ; le serveur n'en stocke que le hash bcrypt.
 */
const genererMotDePasseProvisoire = () => {
  const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES + SYMBOLES;
  const garantie = tirer(MAJUSCULES, 2) + tirer(MINUSCULES, 2) + tirer(CHIFFRES, 2) + tirer(SYMBOLES, 2);
  const complet = garantie + tirer(TOUS, 6); // 8 garantis + 6 libres = 14
  return melanger(complet.split('')).join('');
};

/**
 * POLITIQUE DE MOT DE PASSE (AUTH-005, audit) — appliquée partout où un mot
 * de passe est CHOISI (création de compte, changement, réinitialisation) :
 *   - 12 caractères MINIMUM (128 maximum pour borner bcrypt),
 *   - au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole.
 * La vérification d'un mot de passe EXISTANT (login) n'y est jamais soumise.
 */
const LONGUEUR_MIN = 12;
const LONGUEUR_MAX = 128;
// AUTH-008 (audit) : bcrypt tronque SILENCIEUSEMENT au-delà de 72 OCTETS —
 // deux mots de passe différents pouvaient produire le même hash. La limite
 // est donc exprimée en octets UTF-8 et refusée explicitement.
const OCTETS_MAX_BCRYPT = 72;
const verifPolitique = (mdp) => {
  const s = String(mdp || '');
  if (s.length < LONGUEUR_MIN) return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.`;
  if (s.length > LONGUEUR_MAX) return 'Le mot de passe est trop long.';
  if (Buffer.byteLength(s, 'utf8') > OCTETS_MAX_BCRYPT) return 'Le mot de passe dépasse 72 octets (limite bcrypt) — raccourcissez-le.';
  if (!/[A-Z]/.test(s)) return 'Le mot de passe doit contenir au moins une majuscule.';
  if (!/[a-z]/.test(s)) return 'Le mot de passe doit contenir au moins une minuscule.';
  if (!/[0-9]/.test(s)) return 'Le mot de passe doit contenir au moins un chiffre.';
  if (!/[^A-Za-z0-9]/.test(s)) return 'Le mot de passe doit contenir au moins un caractère spécial.';
  return null; // conforme
};

module.exports = { genererMotDePasseProvisoire, verifPolitique, LONGUEUR_MIN };

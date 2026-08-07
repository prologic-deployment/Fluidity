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

module.exports = { genererMotDePasseProvisoire };

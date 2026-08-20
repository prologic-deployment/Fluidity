const { randomInt } = require('crypto');

/**
 * Génération de mots de passe provisoires — aléa cryptographique sûr.
 * 14 caractères, 4 classes garanties, alphabets désambiguïsés.
 */
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULES = 'abcdefghijkmnopqrstuvwxyz';
const CHIFFRES = '23456789';
const SYMBOLES = '!#$%&*+-=?@';

const tirer = (alphabet, n) => {
  let sortie = '';
  for (let i = 0; i < n; i += 1) sortie += alphabet[randomInt(alphabet.length)];
  return sortie;
};

const melanger = (caracteres) => {
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres;
};

const genererMotDePasseProvisoire = () => {
  const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES + SYMBOLES;
  const garantie = tirer(MAJUSCULES, 2) + tirer(MINUSCULES, 2) + tirer(CHIFFRES, 2) + tirer(SYMBOLES, 2);
  const complet = garantie + tirer(TOUS, 6);
  return melanger(complet.split('')).join('');
};

module.exports = { genererMotDePasseProvisoire };

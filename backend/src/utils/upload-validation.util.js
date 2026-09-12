/**
 * UPL-001 / UPL-003 (audit) : validation des téléversements.
 *
 * Trois barrières successives :
 *   1. extension + MIME déclarés (fileFilter multer — avant écriture),
 *   2. QUOTA de stockage du tenant (calculé avant écriture),
 *   3. signature binaire (« magic bytes ») vérifiée APRÈS écriture — un
 *      fichier dont le contenu ne correspond pas à son extension est refusé
 *      et supprimé (bloque « rapport.pdf » qui serait un exécutable).
 *
 * Les avatars (catégorie « profile-pictures ») n'acceptent que des images.
 */
const fs = require('fs');
const path = require('path');

/** Extensions acceptées → familles de vérification. */
const EXTENSIONS_AUTORISEES = {
  // Documents bureautiques
  '.pdf': 'pdf',
  '.doc': 'ole2',
  '.docx': 'zip',
  '.xls': 'ole2',
  '.xlsx': 'zip',
  '.ppt': 'ole2',
  '.pptx': 'zip',
  '.odt': 'zip',
  '.ods': 'zip',
  '.odp': 'zip',
  // Données texte
  '.txt': 'texte',
  '.csv': 'texte',
  '.eml': 'texte',
  // Images
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.gif': 'gif',
  // Archives
  '.zip': 'zip',
};

const EXTENSIONS_IMAGES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/** MIME déclarés plausibles par extension (le navigateur peut envoyer octet-stream pour les documents). */
const MIME_PAR_FAMILLE = {
  pdf: ['application/pdf', 'application/octet-stream'],
  ole2: [
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/octet-stream',
  ],
  zip: [
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/octet-stream',
  ],
  texte: ['text/plain', 'text/csv', 'message/rfc822', 'application/octet-stream'],
  png: ['image/png'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
};

const estExtensionValide = (nomFichier, categorie) => {
  const ext = path.extname(String(nomFichier || '')).toLowerCase();
  if (!EXTENSIONS_AUTORISEES[ext]) return false;
  if (categorie === 'profile-pictures' && !EXTENSIONS_IMAGES.has(ext)) return false;
  return true;
};

const estMimeValide = (nomFichier, mimetype) => {
  const ext = path.extname(String(nomFichier || '')).toLowerCase();
  const famille = EXTENSIONS_AUTORISEES[ext];
  if (!famille) return false;
  return MIME_PAR_FAMILLE[famille].includes(String(mimetype || '').toLowerCase());
};

/** Signatures binaires attendues par famille. */
const verifSignature = (buffer, famille) => {
  const b = buffer;
  switch (famille) {
    case 'pdf':
      return b.length >= 4 && b.subarray(0, 4).toString('latin1') === '%PDF';
    case 'png':
      return b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'gif':
      return b.length >= 6 && (b.subarray(0, 6).toString('latin1') === 'GIF87a' || b.subarray(0, 6).toString('latin1') === 'GIF89a');
    case 'webp':
      return b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'zip':
      return b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    case 'ole2':
      return b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case 'texte': {
      // Pas de signature : heuristique « pas d'octet NUL dans l'échantillon ».
      const echantillon = b.subarray(0, 1024);
      return !echantillon.includes(0);
    }
    default:
      return false;
  }
};

/**
 * Vérifie le CONTENU d'un fichier écrit sur disque. Retourne `null` si
 * conforme, sinon la raison du rejet.
 */
const verifierContenuFichier = (cheminAbsolu, nomOriginal) => {
  const ext = path.extname(String(nomOriginal || cheminAbsolu)).toLowerCase();
  const famille = EXTENSIONS_AUTORISEES[ext];
  if (!famille) return 'extension non autorisée';
  let fd;
  try {
    fd = fs.openSync(cheminAbsolu, 'r');
    const buffer = Buffer.alloc(1024);
    const lus = fs.readSync(fd, buffer, 0, 1024, 0);
    if (!verifSignature(buffer.subarray(0, lus), famille)) {
      return 'le contenu du fichier ne correspond pas à son extension';
    }
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
};

/** Taille totale (octets) du dossier d'uploads d'un tenant. */
const usageOctetsTenant = (dossierTenant) => {
  let total = 0;
  const parcourir = (dir) => {
    let entrees;
    try {
      entrees = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      const p = path.join(dir, entree.name);
      if (entree.isDirectory()) parcourir(p);
      else if (entree.isFile()) {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* fichier en cours de suppression */
        }
      }
    }
  };
  parcourir(dossierTenant);
  return total;
};

module.exports = {
  EXTENSIONS_AUTORISEES,
  estExtensionValide,
  estMimeValide,
  verifierContenuFichier,
  usageOctetsTenant,
};

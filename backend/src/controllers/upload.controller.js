const { urlRelativeUpload } = require('../utils/upload-file.util');

/**
 * Réception de fichiers (photos de profil, pièces jointes des Demandes /
 * Changements, logos…). Les fichiers sont déjà rangés par le middleware dans
 * uploads/tenants/<tenantId>/<categorie>/ ; on renvoie pour chacun son URL
 * CANONIQUE RELATIVE (servie statiquement — voir app.js) : c'est la forme
 * stockée en base (ex. `avatarUrl`, `piecesJointes`), portable entre
 * environnements et derrière un proxy inverse. Le frontend la résout en URL
 * affichable au niveau présentation (utils/upload-url.util côté Angular).
 */
const uploadFiles = (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: 'Aucun fichier reçu' });
    return;
  }

  const files = req.files.map((f) => ({
    url: urlRelativeUpload(req.tenantId, req.categorieUpload, f.filename),
    nom: f.originalname,
    taille: f.size,
    type: f.mimetype,
    categorie: req.categorieUpload,
  }));

  res.status(201).json({ files });
};

module.exports = { uploadFiles };

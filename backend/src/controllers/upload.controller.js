const { CATEGORIES_UPLOAD, CATEGORIE_PAR_DEFAUT } = require('../utils/upload-file.util');

/**
 * Réception de fichiers (pièces jointes / avatar).
 * Retourne, pour chaque fichier, une URL RELATIVE canonique
 * « /uploads/<categorie>/<uuid>.<ext> » servie statiquement (app.js).
 */
const uploadFiles = (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: 'Aucun fichier reçu' });
    return;
  }

  const categorie = CATEGORIES_UPLOAD.includes(req.params?.categorie)
    ? req.params.categorie
    : CATEGORIE_PAR_DEFAUT;

  const files = req.files.map((f) => ({
    url: `/uploads/${categorie}/${f.filename}`,
    nom: f.originalname,
    taille: f.size,
    type: f.mimetype,
  }));

  res.status(201).json({ files });
};

module.exports = { uploadFiles };

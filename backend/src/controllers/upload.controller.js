/**
 * Réception de fichiers (pièces jointes des Demandes/Changements, photos de
 * profil). Retourne pour chaque fichier son URL CANONIQUE RELATIVE
 * (« /uploads/<tenant>/<fichier> », servie statiquement — voir app.js) :
 * c'est la forme stockée en base (ex. `piecesJointes`, `avatarUrl`), portable
 * entre environnements et derrière un proxy inverse. Le frontend la résout en
 * URL affichable au niveau présentation (utils/upload-url.util côté Angular)
 * — cause racine historique des images 404 corrigée à cet endroit unique.
 */
const uploadFiles = (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: 'Aucun fichier reçu' });
    return;
  }

  const files = req.files.map((f) => ({
    url: `/uploads/${req.tenantId}/${f.filename}`,
    nom: f.originalname,
    taille: f.size,
    type: f.mimetype,
  }));

  res.status(201).json({ files });
};

module.exports = { uploadFiles };

/**
 * Réception de fichiers (pièces jointes des Demandes/Changements).
 * Retourne, pour chaque fichier, une URL absolue servie statiquement
 * (voir app.js : app.use('/uploads', express.static(...))), utilisable
 * directement comme entrée du tableau `piecesJointes`.
 */
const uploadFiles = (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: 'Aucun fichier reçu' });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const files = req.files.map((f) => ({
    url: `${baseUrl}/uploads/${req.tenantId}/${f.filename}`,
    nom: f.originalname,
    taille: f.size,
    type: f.mimetype,
  }));

  res.status(201).json({ files });
};

module.exports = { uploadFiles };

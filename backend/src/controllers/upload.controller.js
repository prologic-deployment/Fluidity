const fs = require('fs');
const { urlRelativeUpload } = require('../utils/upload-file.util');
const { verifierContenuFichier } = require('../utils/upload-validation.util');
const { audit } = require('../utils/saas-log.util');

/**
 * Réception de fichiers (photos de profil, pièces jointes des Demandes /
 * Changements, logos…). Les fichiers sont déjà rangés par le middleware dans
 * uploads/tenants/<tenantId>/<categorie>/[subpath/] ; on renvoie pour chacun
 * son URL CANONIQUE RELATIVE (servie statiquement — voir app.js) : c'est la
 * forme stockée en base (ex. `avatarUrl`, `piecesJointes`), portable entre
 * environnements et derrière un proxy inverse. Le frontend la résout en URL
 * affichable au niveau présentation (utils/upload-url.util côté Angular).
 *
 * UPL-001 (audit) : après écriture, la SIGNATURE BINAIRE de chaque fichier
 * est comparée à son extension — tout fichier dont le contenu ment est
 * supprimé immédiatement et la requête échoue (415). Le lot entier est
 * rejeté (pas d'état partiel exploitable).
 */
const uploadFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: 'Aucun fichier reçu' });
    return;
  }

  for (const f of req.files) {
    const raison = verifierContenuFichier(f.path, f.originalname);
    if (raison) {
      for (const g of req.files) {
        try {
          fs.unlinkSync(g.path);
        } catch {
          /* déjà supprimé */
        }
      }
      res.status(415).json({ message: `Fichier refusé (${f.originalname}) : ${raison}.` });
      return;
    }
  }

  const files = req.files.map((f) => ({
    url: urlRelativeUpload(req.tenantId, req.categorieUpload, f.filename, req.subpathUpload || ''),
    nom: f.originalname,
    taille: f.size,
    type: f.mimetype,
    categorie: req.categorieUpload,
    subpath: req.subpathUpload || '',
  }));

  // LOG-001 : téléversements tracés (nature du contenu, jamais le contenu).
  await audit(req, {
    action: 'upload.created', resource: 'upload',
    metadata: {
      categorie: req.categorieUpload,
      fichiers: files.map((f) => ({ nom: f.nom, taille: f.taille, type: f.type })),
    },
  });

  res.status(201).json({ files });
};

module.exports = { uploadFiles };

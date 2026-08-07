/**
 * Migration de l'arborescence des téléversements (v1 -> v2).
 *
 *   v1 (héritée) : uploads/<tenantId>/<uuid>.<ext>
 *   v2 (cible)   : uploads/tenants/<tenantId>/<categorie>/<uuid>.<ext>
 *
 * Réécrit les références en base vers l'URL canonique v2 :
 *   Utilisateur.avatarUrl        -> profile-pictures
 *   Demande.piecesJointes        -> demandes
 *   Changement.piecesJointes     -> changements
 *   Tenant.logoUrl / faviconUrl  -> logos
 *
 * Les fichiers sont déplacés sur disque (rename, instantané) ; un fichier
 * introuvable conserve son URL d'origine (signalé au résumé — l'ancien
 * montage statique /uploads continue de servir l'arborescence v1, donc
 * rien n'est cassé en l'absence de déplacement). IDEMPOTENT : les URLs
 * déjà au format v2 sont ignorées ; les dossiers v1 vidés sont retirés.
 *
 * Usage : npm run migrate:uploads
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const {
  UPLOADS_ROOT,
  DOSSIER_TENANTS,
  analyserUrlUpload,
  deplacerVersCategorie,
} = require('../utils/upload-file.util');

/** Compteurs FRAIS à chaque exécution (le module peut être appelé plusieurs
 * fois dans le même processus — seed, tests — jamais d'accumulation). */
let resume;
const reinitialiserResume = () => {
  resume = { deplaces: 0, dejaV2: 0, introuvables: 0, externes: 0, documents: 0 };
};
reinitialiserResume();

/** Déplace UNE url héritée vers sa catégorie ; renvoie l'URL finale (inchangée si rien à faire). */
const migrerUrl = (doc, url, categorie) => {
  if (typeof url !== 'string' || !url.trim()) {
    resume.externes += 1; // URL vide ou non textuelle : rien à faire
    return url;
  }
  const analyse = analyserUrlUpload(url);
  if (!analyse) {
    resume.externes += 1; // URL externe (http...) : hors périmètre du stockage local
    return url;
  }
  if (analyse.format === 'v2') {
    resume.dejaV2 += 1;
    return url;
  }
  const nouvelle = deplacerVersCategorie(url, doc.tenantId ?? analyse.tenantId, categorie);
  if (!nouvelle) {
    resume.introuvables += 1;
    console.warn(`  [MigrationUploads] fichier introuvable sur disque, URL conservée : ${url}`);
    return url;
  }
  resume.deplaces += 1;
  return nouvelle;
};

/** Met à jour un champ URL simple (avatar, logo…) sur une collection de documents. */
const migrerChamp = async (Modele, champ, categorie, filtre) => {
  const docs = await Modele.find({ [champ]: { $regex: '^/uploads/', $options: 'i' }, ...filtre });
  for (const doc of docs) {
    const finale = migrerUrl(doc, doc[champ], categorie);
    if (finale !== doc[champ]) {
      doc[champ] = finale;
      await doc.save();
      resume.documents += 1;
    }
  }
};

/** Met à jour un tableau d'URLs (piecesJointes). */
const migrerTableau = async (Modele, champ, categorie) => {
  const docs = await Modele.find({ [champ]: { $elemMatch: { $regex: '^/uploads/' } } });
  for (const doc of docs) {
    let modifie = false;
    doc[champ] = (doc[champ] || []).map((url) => {
      const finale = migrerUrl(doc, url, categorie);
      if (finale !== url) modifie = true;
      return finale;
    });
    if (modifie) {
      await doc.save();
      resume.documents += 1;
    }
  }
};

/** Retire les dossiers v1 vidés (uploads/<tenantId>/) — jamais uploads/tenants. */
const purgerDossiersVides = () => {
  let retires = 0;
  for (const entree of fs.readdirSync(UPLOADS_ROOT, { withFileTypes: true })) {
    if (!entree.isDirectory() || entree.name === DOSSIER_TENANTS) continue;
    const chemin = path.join(UPLOADS_ROOT, entree.name);
    if (fs.readdirSync(chemin).length === 0) {
      fs.rmdirSync(chemin);
      retires += 1;
    }
  }
  return retires;
};

const migrateUploadsStructure = async () => {
  reinitialiserResume();
  console.log('[MigrationUploads] === Migration des téléversements v1 -> v2 ===');
  const { Utilisateur } = require('../models/user.model');
  const { Demande } = require('../models/demande.model');
  const { Changement } = require('../models/changement.model');
  const { Tenant } = require('../models/tenant.model');

  await migrerChamp(Utilisateur, 'avatarUrl', 'profile-pictures');
  await migrerTableau(Demande, 'piecesJointes', 'demandes');
  await migrerTableau(Changement, 'piecesJointes', 'changements');
  await migrerChamp(Tenant, 'logoUrl', 'logos');
  await migrerChamp(Tenant, 'faviconUrl', 'logos');

  const dossiersRetires = purgerDossiersVides();
  console.log(
    `[MigrationUploads] ${resume.deplaces} fichier(s) déplacé(s), ${resume.documents} document(s) mis à jour, ` +
      `${resume.dejaV2} déjà au format v2, ${resume.externes} URL(s) hors stockage local ignorée(s), ` +
      `${resume.introuvables} fichier(s) introuvable(s) (URL conservée), ${dossiersRetires} dossier(s) v1 vidé(s) retiré(s).`
  );
  console.log('[MigrationUploads] === Terminée ===');
  return resume;
};

// Exécution autonome : npm run migrate:uploads
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await migrateUploadsStructure();
    } catch (err) {
      console.error('[MigrationUploads] Échec :', err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { migrateUploadsStructure };

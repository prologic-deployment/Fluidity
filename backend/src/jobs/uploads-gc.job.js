/**
 * UPL-003 (audit) : ramasse-miettes des fichiers téléversés orphelins.
 *
 * Les pièces jointes de dossiers supprimés, les avatars remplacés et les
 * fichiers de projets retirés laissaient des fichiers DEFINITIFS sur disque.
 * Ce job croise le contenu de uploads/tenants/ avec les URL réellement
 * référencées en base ; un fichier non référencé depuis plus de
 * GRACE_DAYS jours est supprimé. La période de grâce protège un fichier
 * fraîchement téléversé, pas encore rattaché à son enregistrement.
 *
 * Exécution : quotidienne, verrouillée (JOB-001) — une seule instance gagne.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { UPLOADS_ROOT, DOSSIER_TENANTS } = require('../utils/upload-file.util');
const { avecVerrouJob } = require('../utils/job-lock.util');
const { normaliserUrlUpload } = require('../utils/upload-file.util');
const logger = require('../utils/logger.util');

const GRACE_DAYS = Number(process.env.UPLOADS_GC_GRACE_DAYS || 30);
const INTERVAL_MS = 24 * 3600 * 1000;

/** Liste récursive des fichiers (chemin absolu + mtime) sous un dossier. */
function listerFichiers(dir, sortie = []) {
  let entrees;
  try {
    entrees = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return sortie;
  }
  for (const entree of entrees) {
    const p = path.join(dir, entree.name);
    if (entree.isDirectory()) listerFichiers(p, sortie);
    else if (entree.isFile()) {
      try {
        sortie.push({ chemin: p, mtime: fs.statSync(p).mtimeMs });
      } catch {
        /* volatil */
      }
    }
  }
  return sortie;
}

/** Toutes les URL d'upload référencées en base (canoniques relatives). */
async function urlsReferencees() {
  const refs = new Set();
  const ajouter = (valeur) => {
    if (!valeur) return;
    if (Array.isArray(valeur)) {
      valeur.forEach(ajouter);
      return;
    }
    if (typeof valeur !== 'string') return;
    const propre = normaliserUrlUpload(valeur).trim();
    if (propre.startsWith('/uploads/')) refs.add(propre);
  };

  const db = mongoose.connection.db;
  const [utilisateurs, clients, demandes, changements, tickets, commentairesTicket, fichiersProjet, projets, taches, livrables, risques, commentairesProjet] =
    await Promise.all([
      db.collection('utilisateurs').find({ avatarUrl: { $ne: null } }, { projection: { avatarUrl: 1 } }).toArray(),
      db.collection('clients').find({ avatarUrl: { $ne: null } }, { projection: { avatarUrl: 1 } }).toArray(),
      db.collection('demandes').find({}, { projection: { piecesJointes: 1 } }).toArray(),
      db.collection('changements').find({}, { projection: { piecesJointes: 1 } }).toArray(),
      db.collection('tickets').find({}, { projection: { piecesJointes: 1 } }).toArray(),
      db.collection('ticketcomments').find({}, { projection: { piecesJointes: 1 } }).toArray(),
      db.collection('projectfiles').find({}, { projection: { url: 1 } }).toArray(),
      db.collection('projects').find({}, { projection: { attachments: 1 } }).toArray(),
      db.collection('tasks').find({}, { projection: { attachments: 1 } }).toArray(),
      db.collection('deliverables').find({}, { projection: { attachments: 1 } }).toArray(),
      db.collection('risks').find({}, { projection: { attachments: 1 } }).toArray(),
      db.collection('projectcomments').find({}, { projection: { attachments: 1 } }).toArray(),
    ]);

  utilisateurs.forEach((u) => ajouter(u.avatarUrl));
  clients.forEach((c) => ajouter(c.avatarUrl));
  demandes.forEach((d) => ajouter(d.piecesJointes));
  changements.forEach((c) => ajouter(c.piecesJointes));
  tickets.forEach((t) => ajouter(t.piecesJointes));
  commentairesTicket.forEach((c) => ajouter(c.piecesJointes));
  fichiersProjet.forEach((f) => ajouter(f.url));
  const ajouterPieces = (doc) => ajouter(doc.attachments?.map((a) => (typeof a === 'string' ? a : a?.url)));
  projets.forEach(ajouterPieces);
  taches.forEach(ajouterPieces);
  livrables.forEach(ajouterPieces);
  risques.forEach(ajouterPieces);
  commentairesProjet.forEach(ajouterPieces);
  return refs;
}

async function runUploadsGC() {
  const racineTenants = path.join(UPLOADS_ROOT, DOSSIER_TENANTS);
  if (!fs.existsSync(racineTenants)) return { supprimes: 0, conserves: 0 };

  const [fichiers, refs] = await Promise.all([listerFichiers(racineTenants), urlsReferencees()]);
  const seuil = Date.now() - GRACE_DAYS * 24 * 3600 * 1000;
  let supprimes = 0;
  for (const fichier of fichiers) {
    // Chemin absolu → URL relative canonique /uploads/tenants/…
    const urlRelative = '/uploads/' + path.relative(UPLOADS_ROOT, fichier.chemin).split(path.sep).join('/');
    if (refs.has(urlRelative)) continue;
    if (fichier.mtime > seuil) continue; // période de grâce
    try {
      fs.unlinkSync(fichier.chemin);
      supprimes += 1;
    } catch {
      /* déjà supprimé */
    }
  }
  if (supprimes > 0) logger.info('uploads-gc : fichiers orphelins supprimés', { supprimes, graceDays: GRACE_DAYS });
  return { supprimes, conserves: fichiers.length - supprimes };
}

function startUploadsGCJob(intervalMs = INTERVAL_MS) {
  const executer = () =>
    avecVerrouJob('uploads-gc', intervalMs, runUploadsGC).catch((err) =>
      logger.error('uploads-gc en échec', { err })
    );
  executer();
  return setInterval(executer, intervalMs);
}

module.exports = { runUploadsGC, startUploadsGCJob, GRACE_DAYS };

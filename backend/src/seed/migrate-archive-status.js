/**
 * Migration A5.3 Fix 4 — archivage à mécanisme unique (statut `archived`).
 *
 *   avant : booléen Project.archived (parallèle au statut) ;
 *   après : Project.status = 'archived' (Project.archivedAt/By conservés
 *           comme métadonnées d'audit, champ booléen supprimé).
 *
 * Le script est IDEMPOTENT : seuls les projets encore porteurs du booléen
 * (archived: true) sont convertis ; les projets déjà en statut `archived`
 * sont ignorés. Aucune donnée n'est perdue.
 *
 * Usage : npm run migrate:archive-status
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { Project } = require('../models/project.models');

async function migrateArchiveStatus() {
  console.log('[Migration] === Archivage → statut unique ===');
  const res = await Project.updateMany(
    { archived: true, status: { $ne: 'archived' } },
    [
      {
        $set: {
          status: 'archived',
          archivedAt: { $ifNull: ['$archivedAt', '$$NOW'] },
        },
      },
      { $unset: 'archived' },
    ]
  );
  console.log(`[Migration] projets convertis : ${res.modifiedCount}.`);
  // Purge résiduelle du booléen (projets non archivés mais champ présent).
  const purge = await Project.updateMany({ archived: { $exists: true } }, { $unset: { archived: '' } });
  console.log(`[Migration] booléens résiduels purgés : ${purge.modifiedCount}.`);
  console.log('[Migration] === Migration archivage terminée ===');
}

// Exécution autonome : npm run migrate:archive-status
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await migrateArchiveStatus();
    } catch (err) {
      console.error('[Migration] Échec :', err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { migrateArchiveStatus };

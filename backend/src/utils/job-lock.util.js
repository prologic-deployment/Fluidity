/**
 * JOB-001 (audit) : verrou d'exécution des tâches planifiées.
 *
 * Sans verrou, chaque instance d'API exécute ses propres timers — les jobs
 * (clôture auto, expiration SaaS, échéances projet, ménage uploads) se
 * dupliquent en multi-instance. Le verrou est posé en BASE (collection
 * `joblocks`) via une prise atomique :
 *   - création du document sinon rien,
 *   - reprise uniquement si le verrou existant a EXPIRÉ.
 * Le verrou reste posé jusqu'à son TTL (≈ cadence du job) : une seule
 * instance gagne par cycle. Les jobs restent idempotents par conception.
 */
const mongoose = require('mongoose');
const os = require('os');
const { randomUUID } = require('crypto');

const JobLockSchema = new mongoose.Schema(
  {
    _id: String, // nom du job
    holder: String,
    lockedUntil: Date,
    updatedAt: Date,
  },
  { versionKey: false }
);
const JobLock = mongoose.models.JobLock || mongoose.model('JobLock', JobLockSchema);

const INSTANCE_ID = `${os.hostname()}-${process.pid}-${randomUUID()}`;

/**
 * Tente de prendre le verrou `nom` pour `ttlMs`, puis exécute `fn`.
 * @returns {Promise<boolean>} true si le job a été exécuté par cette instance.
 */
async function avecVerrouJob(nom, ttlMs, fn) {
  const maintenant = new Date();
  const expiration = new Date(maintenant.getTime() + ttlMs);
  let pris = false;
  try {
    await JobLock.create({ _id: nom, holder: INSTANCE_ID, lockedUntil: expiration, updatedAt: maintenant });
    pris = true;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // Verrou existant : reprise atomique seulement s'il a expiré.
    const repris = await JobLock.findOneAndUpdate(
      { _id: nom, lockedUntil: { $lt: maintenant } },
      { $set: { holder: INSTANCE_ID, lockedUntil: expiration, updatedAt: maintenant } },
      { new: true }
    );
    pris = !!repris;
  }
  if (!pris) return false;
  await fn();
  return true;
}

module.exports = { avecVerrouJob, JobLock, INSTANCE_ID };

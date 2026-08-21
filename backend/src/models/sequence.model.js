const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Compteur de séquences pour générer des références incrémentales uniques
 * et sûres en concurrence (atomicité de findOneAndUpdate $inc).
 */
const SequenceSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const Sequence = mongoose.model('Sequence', SequenceSchema);

/**
 * Génère la référence incrémentale suivante pour une clé donnée.
 * Format : <prefix>-<année>-<seq sur 5 chiffres>, ex. DEM-2026-00042.
 * Atomique : l'incrément ($inc) et l'upsert sont effectués en une opération,
 * garantissant l'unicité même sous création concurrente.
 *
 * @param {string} key    clé de séquence (ex. 'demande', 'changement')
 * @param {string} prefix préfixe de la référence (ex. 'DEM', 'CHG')
 */
async function nextReference(key, prefix) {
  const year = new Date().getFullYear();
  const doc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${year}-${String(doc.seq).padStart(5, '0')}`;
}

module.exports = { Sequence, nextReference };

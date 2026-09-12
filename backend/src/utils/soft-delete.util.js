/**
 * DB-002 (audit) : suppression logique (soft delete) des dossiers.
 *
 * Plutôt que de multiplier les filtres « deletedAt » dans chaque requête, le
 * schéma reçoit un middleware Mongoose qui exclut AUTOMATIQUEMENT les fiches
 * tombstonnées de toutes les lectures / écritures par requête (find, findOne,
 * findOneAndUpdate, countDocuments). La suppression « physique » devient la
 * pose d'un horodatage `deletedAt` : la donnée reste en base (traçabilité,
 * restauration éventuelle) mais disparaît de toutes les vues et de tous les
 * comptes d'intégrité référentielle.
 */
function activerSuppressionLogique(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  const exclure = function exclureTombstones() {
    const filtre = this.getFilter();
    // Une requête qui mentionne déjà deletedAt sait ce qu'elle fait.
    if (Object.prototype.hasOwnProperty.call(filtre, 'deletedAt')) return;
    filtre.deletedAt = null;
  };

  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'distinct'], exclure);
}

module.exports = { activerSuppressionLogique };

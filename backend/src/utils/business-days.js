/**
 * Jours ouvrés — samedi et dimanche exclus.
 * Extensible : passer `isHoliday(date)` pour exclure des jours fériés plus tard.
 */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessDay(date, isHoliday) {
  if (isWeekend(date)) return false;
  if (typeof isHoliday === 'function' && isHoliday(date)) return false;
  return true;
}

/** Ajoute `n` jours ouvrés à `from` (n >= 1). */
function addBusinessDays(from, n, isHoliday) {
  const cursor = new Date(from);
  let remaining = n;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor, isHoliday)) remaining -= 1;
  }
  return cursor;
}

/** Nombre de jours ouvrés complets entre `from` et `to` (to exclusif du dernier jour partiel). */
function businessDaysBetween(from, to, isHoliday) {
  if (!from || !to || to <= from) return 0;
  const cursor = startOfDay(from);
  cursor.setDate(cursor.getDate() + 1);
  const end = startOfDay(to);
  let count = 0;
  while (cursor <= end) {
    if (isBusinessDay(cursor, isHoliday)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

module.exports = { isWeekend, isBusinessDay, addBusinessDays, businessDaysBetween, startOfDay };

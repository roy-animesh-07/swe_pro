const config = require('./config');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a calendar date in YYYY-MM-DD form into a Date at UTC midnight.
 * Returns null when the value is not a real calendar date.
 */
function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Format a Date (stored at UTC midnight) as YYYY-MM-DD. */
function formatDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in the configured court timezone, as a UTC-midnight Date. */
function todayInCourt() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.courtTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseDateOnly(parts);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

module.exports = { parseDateOnly, formatDate, todayInCourt, addDays };

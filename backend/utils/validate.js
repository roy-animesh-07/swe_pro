const { badRequest } = require('./errors');
const { parseDateOnly } = require('./dates');

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Check that every listed field is a non-empty string. Returns trimmed values.
 * Throws 400 VALIDATION_ERROR listing the missing fields.
 */
function requireStrings(body, fields) {
  const src = body || {};
  const missing = fields.filter((f) => !isNonEmptyString(src[f]));
  if (missing.length) {
    throw badRequest('VALIDATION_ERROR', `Required field(s) missing or empty: ${missing.join(', ')}.`);
  }
  const out = {};
  for (const f of fields) out[f] = src[f].trim();
  return out;
}

/** Parse listed fields as YYYY-MM-DD dates. Throws 400 INVALID_DATE. */
function requireDates(body, fields) {
  const src = body || {};
  const out = {};
  const bad = [];
  for (const f of fields) {
    const d = parseDateOnly(src[f]);
    if (!d) bad.push(f);
    else out[f] = d;
  }
  if (bad.length) {
    throw badRequest('INVALID_DATE', `Invalid date for: ${bad.join(', ')}. Use YYYY-MM-DD.`);
  }
  return out;
}

module.exports = { isNonEmptyString, requireStrings, requireDates };

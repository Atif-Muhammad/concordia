const mongoose = require('mongoose');

/** Parse scalar, array, or comma-separated filter values into trimmed strings, ignoring "all"/"*" sentinels. */
function parseMulti(val) {
  if (!val || val === 'all' || val === '*' || val === 'ALL') return [];
  const raw = Array.isArray(val) ? val : String(val).split(',');
  return raw
    .map((v) => String(v).trim())
    .filter((v) => v && v !== 'all' && v !== '*' && v !== 'ALL' && v !== 'undefined' && v !== 'null');
}

function toObjectIds(vals) {
  return parseMulti(vals)
    .filter((v) => mongoose.Types.ObjectId.isValid(v))
    .map((v) => new mongoose.Types.ObjectId(v));
}

function applyMultiIdFilter(query, field, val) {
  const ids = toObjectIds(val);
  if (ids.length === 1) query[field] = ids[0];
  else if (ids.length > 1) query[field] = { $in: ids };
  return ids;
}

function escapeRegexSimple(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match single or comma-separated string values case-insensitively on a Mongo query field. */
function applyMultiStringFilter(query, field, val, { caseInsensitive = true } = {}) {
  const vals = parseMulti(val);
  if (vals.length === 0) return [];
  if (vals.length === 1) {
    query[field] = caseInsensitive ? new RegExp(`^${escapeRegexSimple(vals[0])}$`, 'i') : vals[0];
  } else {
    query[field] = {
      $in: vals.map((v) => (caseInsensitive ? new RegExp(`^${escapeRegexSimple(v)}$`, 'i') : v)),
    };
  }
  return vals;
}

/** Check whether a candidate value matches a multi-select filter string/array. */
function matchesMultiValue(selectedVal, candidateVal, { caseInsensitive = true } = {}) {
  const vals = parseMulti(selectedVal);
  if (vals.length === 0) return true;
  const cand = String(candidateVal ?? '').trim();
  if (!caseInsensitive) return vals.includes(cand);
  const candLower = cand.toLowerCase();
  return vals.some((v) => v.toLowerCase() === candLower);
}

/** Parse booleans cleanly even when submitted from HTML select/form inputs as "true"/"false". */
function parseBooleanFlag(val, fallback = false) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  return Boolean(val);
}

module.exports = {
  parseMulti,
  toObjectIds,
  applyMultiIdFilter,
  applyMultiStringFilter,
  matchesMultiValue,
  parseBooleanFlag,
};

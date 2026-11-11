const DEFAULT_STUDENT_SEARCH_FIELDS = ['fName', 'lName', 'rollNumber', 'fatherOrguardian'];
const DEFAULT_NAME_PART_FIELDS = ['fName', 'lName'];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeSearchQuery(search = '') {
  return String(search || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function buildFlexibleWhitespaceRegex(search = '') {
  const tokens = tokenizeSearchQuery(search);
  if (tokens.length === 0) return null;
  return new RegExp(tokens.map(escapeRegex).join('\\s+'), 'i');
}

/**
 * Builds a MongoDB query condition for searching students by first name,
 * last name, multi-word full name (tolerating trailing/extra whitespace),
 * father/guardian name, roll number, and any extra fields.
 */
function buildStudentSearchCondition(search = '', options = {}) {
  const tokens = tokenizeSearchQuery(search);
  if (tokens.length === 0) return null;

  const {
    fields = DEFAULT_STUDENT_SEARCH_FIELDS,
    extraFields = [],
    namePartsFields = DEFAULT_NAME_PART_FIELDS,
  } = options;

  const phraseRegex = new RegExp(tokens.map(escapeRegex).join('\\s+'), 'i');
  const allSingleFields = [...new Set([...fields, ...extraFields])];
  const orBranches = allSingleFields.map((field) => ({ [field]: phraseRegex }));

  if (tokens.length > 1 && namePartsFields.length > 0) {
    orBranches.push({
      $and: tokens.map((token) => {
        const tokenRegex = new RegExp(escapeRegex(token), 'i');
        return {
          $or: namePartsFields.map((field) => ({ [field]: tokenRegex })),
        };
      }),
    });
  }

  return { $or: orBranches };
}

module.exports = {
  escapeRegex,
  tokenizeSearchQuery,
  buildFlexibleWhitespaceRegex,
  buildStudentSearchCondition,
};

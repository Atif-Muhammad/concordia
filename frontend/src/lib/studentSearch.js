export function normalizeSearchText(value = '') {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function formatNormalizedFullName(fName = '', lName = '') {
  return [fName, lName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
}

export function tokenizeSearchText(query = '') {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Matches a user search query against candidate fields (full name, father name,
 * roll number, challan number, etc.) tolerating extra spaces and multi-word order.
 */
export function matchesSearchTokens(query = '', fields = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedFields = fields
    .map((field) => normalizeSearchText(field))
    .filter(Boolean);

  if (normalizedFields.length === 0) return false;

  if (normalizedFields.some((field) => field.includes(normalizedQuery))) {
    return true;
  }

  const tokens = normalizedQuery.split(' ');
  if (tokens.length > 1) {
    return normalizedFields.some((field) =>
      tokens.every((token) => field.includes(token))
    );
  }

  return false;
}

const INTERNAL_OR_DB_MSG_RE =
  /\b(is not defined|cannot read propert|cannot set propert|is not a function|cast to (objectid|number|date|boolean|string)|e11000 duplicate key|mongoservererror|mongonetworkerror|mongotimeout|mongoose|objectid|strictpopulateerror|overwritemodelerror|missingschemaerror|buffering timed out|econnrefused|etimedout|topology is closed|validation failed)\b/i;

const INTERNAL_ERR_NAMES = new Set([
  'ReferenceError',
  'TypeError',
  'SyntaxError',
  'RangeError',
  'StrictPopulateError',
  'OverwriteModelError',
  'MissingSchemaError',
  'ParallelSaveError',
]);

const DB_UNAVAILABLE_NAMES = new Set([
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoTimeoutError',
  'MongoWaitQueueTimeoutError',
]);

/** Convert raw Mongoose/MongoDB/runtime errors into clear end-user messages without leaking internals. */
function normalizeUserError(err, req = null) {
  const safeErr = err && typeof err === 'object' ? err : new Error(String(err || 'Unexpected error'));
  const rawMessage = String(safeErr.message || '');
  const errName = String(safeErr.name || '');
  const url = String(req?.originalUrl || req?.url || '');
  const isReportRoute = url.includes('/reports');

  // 1. Database connectivity / timeout errors
  if (
    DB_UNAVAILABLE_NAMES.has(errName) ||
    /(buffering timed out|econnrefused|etimedout|enotfound|topology is closed|server selection timed out)/i.test(rawMessage)
  ) {
    return {
      status: 503,
      message: 'Unable to connect to the database right now. Please wait a moment and try again.',
    };
  }

  // 2. Mongoose invalid ObjectId / field type cast
  if (errName === 'CastError') {
    const kind = String(safeErr.kind || '').toLowerCase();
    if (kind === 'date') {
      return { status: 400, message: 'One of the selected dates is invalid. Please check your date filters and try again.' };
    }
    if (kind === 'number') {
      return { status: 400, message: 'Please enter a valid number and try again.' };
    }
    return {
      status: 400,
      message: isReportRoute
        ? 'One of the selected filters or records is invalid. Please reset your filters and try again.'
        : 'Invalid record reference provided. Please refresh the page and try again.',
    };
  }

  // 3. Mongoose schema validation errors
  if (errName === 'ValidationError' && safeErr.errors && typeof safeErr.errors === 'object') {
    const parts = Object.values(safeErr.errors)
      .map((e) => String(e?.message || '').trim())
      .filter((m) => m && !INTERNAL_OR_DB_MSG_RE.test(m));
    return {
      status: 400,
      message: parts.length > 0 ? parts.join(' ') : 'Please check the entered information and try again.',
    };
  }

  // 4. MongoDB duplicate key conflict
  if (safeErr.code === 11000 || safeErr.code === 11001 || /E11000 duplicate key/i.test(rawMessage)) {
    const fields = Object.keys(safeErr.keyPattern || safeErr.keyValue || {})
      .map((f) => f.replace(/([A-Z])/g, ' $1').trim().toLowerCase())
      .filter(Boolean);
    return {
      status: 409,
      message: fields.length > 0
        ? `A record with this ${fields.join(', ')} already exists.`
        : 'A matching record already exists. Duplicate entries are not allowed.',
    };
  }

  const rawStatus = Number(safeErr.statusCode || safeErr.status || 500);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;

  // 5. Internal JS runtime bugs, unexpected 5xx, or raw DB leak text -> never expose raw text
  if (
    status >= 500 ||
    INTERNAL_ERR_NAMES.has(errName) ||
    INTERNAL_OR_DB_MSG_RE.test(rawMessage)
  ) {
    const isAction = isReportRoute && url.includes('/action');
    return {
      status: status >= 500 ? status : 500,
      message: isReportRoute
        ? (isAction
            ? 'Unable to complete this report action due to a temporary server issue. Please try again.'
            : 'Unable to generate this report right now due to a temporary server issue. Please try again.')
        : 'Something went wrong while processing your request. Please try again.',
    };
  }

  // 6. Clean explicit 4xx validation / authorization / not-found errors
  return {
    status,
    message: rawMessage || 'Your request could not be completed. Please check your inputs and try again.',
  };
}

const errorHandler = (err, req, res, next) => {
  console.error(err?.stack || err);
  const { status, message } = normalizeUserError(err, req);
  res.locals.errorMessage = message;
  res.status(status).json({
    message,
    error: process.env.NODE_ENV === 'production' || status >= 500 ? null : message,
  });
};

errorHandler.normalizeUserError = normalizeUserError;

module.exports = errorHandler;

const { ApiError, isDuplicateKeyError } = require('../utils/errors');

function notFoundRoute(req, res) {
  res.status(404).json({ error: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}.` });
}

// Single consistent error shape: { error, message }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON.' });
  }
  if (isDuplicateKeyError(err)) {
    return res.status(409).json({ error: 'DUPLICATE', message: 'A record with the same unique value already exists.' });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected server error occurred. Please try again.' });
}

module.exports = { errorHandler, notFoundRoute };

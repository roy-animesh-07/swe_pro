class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (code, message) => new ApiError(400, code, message);
const unauthorized = (message = 'Authentication required.') =>
  new ApiError(401, 'NOT_AUTHENTICATED', message);
const forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError(403, 'FORBIDDEN', message);
const notFound = (code, message) => new ApiError(404, code, message);
const conflict = (code, message) => new ApiError(409, code, message);

function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, isDuplicateKeyError };

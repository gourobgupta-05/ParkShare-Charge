/**
 * 🔒 Throw this from anywhere; errorHandler turns it into a JSON envelope.
 *   throw ApiError.badRequest('Slot already booked', ERROR_CODES.SLOT_ALREADY_BOOKED);
 */
const { ERROR_CODES } = require('../shared/constants');

class ApiError extends Error {
  constructor(statusCode, message, code = ERROR_CODES.INTERNAL, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, code = ERROR_CODES.VALIDATION_FAILED, details) {
    return new ApiError(400, msg, code, details);
  }
  static unauthorized(msg = 'Sign in to continue', code = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, msg, code);
  }
  static forbidden(msg = 'You do not have access to this', code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, msg, code);
  }
  static notFound(msg = 'Not found', code = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, msg, code);
  }
  static conflict(msg, code = ERROR_CODES.VALIDATION_FAILED) {
    return new ApiError(409, msg, code);
  }
  static notImplemented(msg = 'Not implemented yet') {
    return new ApiError(501, msg, ERROR_CODES.NOT_IMPLEMENTED);
  }
}

module.exports = ApiError;

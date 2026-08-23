/**
 * 🔒 DO NOT EDIT AFTER INITIAL SETUP.
 * Converts everything thrown anywhere in the app into the standard envelope.
 * Errors explain what happened and how to fix it. They never apologise.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../shared/constants');

function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let error = err;

  // Mongoose: bad ObjectId
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}`);
  }
  // Mongoose: schema validation
  else if (err.name === 'ValidationError') {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
    error = ApiError.badRequest('Check the highlighted fields', ERROR_CODES.VALIDATION_FAILED, details);
  }
  // Mongo: duplicate key
  else if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    const map = { email: ERROR_CODES.EMAIL_TAKEN, phone: ERROR_CODES.PHONE_TAKEN };
    error = ApiError.conflict(`That ${field} is already registered`, map[field] || ERROR_CODES.VALIDATION_FAILED);
  }
  // Not one of ours
  else if (!(err instanceof ApiError)) {
    error = new ApiError(err.statusCode || 500, err.message || 'Something went wrong', ERROR_CODES.INTERNAL);
    error.isOperational = false;
  }

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(`${error.statusCode} ${error.message}\n${err.stack}`);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
    ...(env.isDev && !error.isOperational ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };

/**
 * 🔒 Dependency-free validation helpers. Use in your own validators so error
 * shapes stay consistent across all four members' features.
 *
 *   const { validate, rules } = require('../../middleware/validate');
 *   router.post('/', validate({ email: [rules.required, rules.email] }), ctrl.create);
 */
const ApiError = require('../utils/ApiError');

const rules = {
  required: (v) => (v === undefined || v === null || v === '' ? 'This field is required' : null),
  email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address'),
  // Bangladeshi mobile: 01XXXXXXXXX or +8801XXXXXXXXX
  bdPhone: (v) => (!v || /^(?:\+?88)?01[3-9]\d{8}$/.test(String(v)) ? null : 'Enter a valid Bangladeshi mobile number'),
  minLength: (n) => (v) => (!v || String(v).length >= n ? null : `Must be at least ${n} characters`),
  maxLength: (n) => (v) => (!v || String(v).length <= n ? null : `Must be at most ${n} characters`),
  oneOf: (list) => (v) => (v === undefined || list.includes(v) ? null : `Must be one of: ${list.join(', ')}`),
  number: (v) => (v === undefined || !Number.isNaN(Number(v)) ? null : 'Must be a number'),
  positiveInt: (v) => (v === undefined || (Number.isInteger(Number(v)) && Number(v) > 0) ? null : 'Must be a positive whole number'),
  latitude: (v) => (v === undefined || (Number(v) >= -90 && Number(v) <= 90) ? null : 'Invalid latitude'),
  longitude: (v) => (v === undefined || (Number(v) >= -180 && Number(v) <= 180) ? null : 'Invalid longitude'),
  isoDate: (v) => (v === undefined || !Number.isNaN(Date.parse(v)) ? null : 'Invalid date'),
  strongPassword: (v) =>
    !v || (String(v).length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v))
      ? null
      : 'Use at least 8 characters with a letter and a number',
};

/** Runs a { field: [ruleFn, ...] } map against req.body. */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const data = req[source] || {};
    const details = {};
    for (const [field, checks] of Object.entries(schema)) {
      for (const check of checks) {
        const message = check(data[field]);
        if (message) {
          details[field] = message;
          break;
        }
      }
    }
    if (Object.keys(details).length) {
      return next(ApiError.badRequest('Check the highlighted fields', undefined, details));
    }
    next();
  };
}

module.exports = { validate, rules };

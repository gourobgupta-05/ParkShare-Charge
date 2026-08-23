/**
 * AUTH ROUTES — 🔒 DO NOT EDIT AFTER INITIAL SETUP (Common Feature 1)
 * Mounted at /api/auth
 */
const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');
const { PROPERTY_TYPE } = require('../shared/constants');

const { required, email, bdPhone, strongPassword, minLength, oneOf, latitude, longitude } = rules;

router.post(
  '/register/driver',
  validate({
    name: [required, minLength(2)],
    email: [required, email],
    phone: [required, bdPhone],
    password: [required, strongPassword],
  }),
  ctrl.registerDriver
);

router.post(
  '/register/host',
  validate({
    name: [required, minLength(2)],
    email: [required, email],
    phone: [required, bdPhone],
    password: [required, strongPassword],
    propertyType: [required, oneOf(Object.values(PROPERTY_TYPE))],
    latitude: [required, latitude],
    longitude: [required, longitude],
  }),
  ctrl.registerHost
);

router.post('/login', validate({ email: [required, email], password: [required] }), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;

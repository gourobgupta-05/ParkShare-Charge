/**
 * PROFILE ROUTES — 🔒 DO NOT EDIT AFTER INITIAL SETUP (Common Feature 2)
 * Mounted at /api/profile. Every role uses these.
 */
const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');

const { required, strongPassword } = rules;

router.use(authenticate); // everything below requires a session

router.get('/', ctrl.me);
router.patch('/', ctrl.updateProfile);
router.patch('/preferences', ctrl.updatePreferences);
router.patch(
  '/password',
  validate({ currentPassword: [required], newPassword: [required, strongPassword] }),
  ctrl.changePassword
);
router.delete('/', ctrl.deactivateAccount);

module.exports = router;

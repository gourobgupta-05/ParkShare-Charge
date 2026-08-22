/** ADMIN — 🔒 DO NOT EDIT. Discriminator of User. */
const mongoose = require('mongoose');
const User = require('./User');
const { ROLES } = require('../shared/constants');

const adminSchema = new mongoose.Schema({
  permissions: { type: [String], default: ['ALL'] },
});

module.exports = User.discriminators?.[ROLES.ADMIN] || User.discriminator(ROLES.ADMIN, adminSchema);

/**
 * DRIVER — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * Discriminator of User. Adds the EV specs collected at driver signup.
 */
const mongoose = require('mongoose');
const User = require('./User');
const { ROLES, CONNECTOR_TYPE } = require('../shared/constants');

const driverSchema = new mongoose.Schema({
  ev: {
    make: { type: String, trim: true, default: null },
    model: { type: String, trim: true, default: null },
    batteryKwh: { type: Number, min: 0, max: 500, default: null },
    connectorType: { type: String, enum: [...Object.values(CONNECTOR_TYPE), null], default: null },
    plateNumber: { type: String, trim: true, uppercase: true, default: null },
    colour: { type: String, trim: true, default: null },
  },
  drivingLicenceNo: { type: String, trim: true, default: null },

  // Denormalised counters — cheap to read on the dashboard
  totalBookings: { type: Number, default: 0 },
  outstandingPenaltyPoisha: { type: Number, default: 0 }, // [SMR] penalty
});

driverSchema.index({ 'ev.connectorType': 1 });

module.exports = User.discriminators?.[ROLES.DRIVER] || User.discriminator(ROLES.DRIVER, driverSchema);

/**
 * 🔒 Model barrel. Import from here so registration order is always correct:
 *   const { User, Booking, Property } = require('../../models');
 * Driver/Host/Admin must be required AFTER User (they are discriminators).
 */
const User = require('./User');
const Driver = require('./Driver');
const Host = require('./Host');
const Admin = require('./Admin');
const Property = require('./Property');
const Booking = require('./Booking');
const Session = require('./Session');
const Payment = require('./Payment');
const Wallet = require('./Wallet');
const LedgerEntry = require('./LedgerEntry');
const PlatformConfig = require('./PlatformConfig');
const Notification = require('./Notification');

module.exports = {
  User, Driver, Host, Admin,
  Property, Booking, Session,
  Payment, Wallet, LedgerEntry,
  PlatformConfig, Notification,
};

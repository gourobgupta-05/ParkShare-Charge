/** 🔒 JWT signing / verification for auth + the QR entry pass. */
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });

const signRefreshToken = (user) =>
  jwt.sign({ sub: String(user._id), type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

/** Signed QR entry pass — replaces the cut OCR feature. Used by [SMR]. */
const signEntryPass = (payload) =>
  jwt.sign({ ...payload, kind: 'entry_pass' }, env.QR_PASS_SECRET, {
    expiresIn: `${env.QR_PASS_TTL_MIN}m`,
  });
const verifyEntryPass = (token) => jwt.verify(token, env.QR_PASS_SECRET);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signEntryPass,
  verifyEntryPass,
};

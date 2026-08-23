/**
 * ESCROW VALIDATOR — OWNER: Tamal Deb Nath [TDN]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { PAYMENT_METHOD, ESCROW_STATUS } = require('../../shared/constants');

function parseHoldBody(body = {}) {
  const details = {};
  const { bookingId, method, gatewayToken } = body;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    details.bookingId = 'A valid booking id is required';
  }
  if (method && !Object.values(PAYMENT_METHOD).includes(method)) {
    details.method = `Must be one of: ${Object.values(PAYMENT_METHOD).join(', ')}`;
  }
  if (gatewayToken && String(gatewayToken).length > 200) {
    details.gatewayToken = 'That token is too long';
  }
  if (Object.keys(details).length) throw ApiError.badRequest('Check the payment details', undefined, details);

  return {
    bookingId,
    method: method || PAYMENT_METHOD.WALLET,
    gatewayToken: gatewayToken || null,
  };
}

function parseTopUpBody(body = {}) {
  const amountPoisha = Number(body.amountPoisha);
  if (!Number.isInteger(amountPoisha) || amountPoisha <= 0) {
    throw ApiError.badRequest('Enter a valid amount', undefined, {
      amountPoisha: 'Amount must be a whole number of poisha (৳1 = 100)',
    });
  }
  return { amountPoisha, method: body.method || PAYMENT_METHOD.WALLET };
}

function parseRefundBody(body = {}) {
  const details = {};
  const amountPoisha = body.amountPoisha === undefined ? undefined : Number(body.amountPoisha);

  if (amountPoisha !== undefined && (!Number.isInteger(amountPoisha) || amountPoisha <= 0)) {
    details.amountPoisha = 'Leave blank for a full refund, or give a whole number of poisha';
  }
  if (body.reason && String(body.reason).length > 500) {
    details.reason = 'Keep the reason under 500 characters';
  }
  if (Object.keys(details).length) throw ApiError.badRequest('Check the refund details', undefined, details);

  return { amountPoisha, reason: body.reason ? String(body.reason).trim() : null };
}

function parseStatusFilter(raw) {
  if (!raw) return undefined;
  const key = String(raw).toUpperCase();
  if (!Object.values(ESCROW_STATUS).includes(key)) {
    throw ApiError.badRequest('Unknown escrow status', undefined, {
      status: `Must be one of: ${Object.values(ESCROW_STATUS).join(', ')}`,
    });
  }
  return key;
}

module.exports = { parseHoldBody, parseTopUpBody, parseRefundBody, parseStatusFilter };

/**
 * PROMO VALIDATOR — OWNER: Maidul Islam [MI]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { PROPERTY_TYPE } = require('../../shared/constants');

const CASE_SENSITIVE = process.env.PROMO_CASE_SENSITIVE === 'true';
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

/** Codes are stored uppercase; typing "jamuna20" should still work. */
function normaliseCode(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    throw ApiError.badRequest('Enter a promo code', undefined, { code: 'Promo code is required' });
  }
  const code = CASE_SENSITIVE ? value : value.toUpperCase();
  if (!CODE_RE.test(code.toUpperCase())) {
    throw ApiError.badRequest('That does not look like a valid code', undefined, {
      code: 'Codes are 3-24 letters, numbers, dashes or underscores',
    });
  }
  return code;
}

function parseApplyBody(body = {}) {
  const code = normaliseCode(body.code);
  const { bookingId } = body;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw ApiError.badRequest('A valid booking is required', undefined, {
      bookingId: 'A valid booking id is required',
    });
  }
  return { code, bookingId };
}

function parseAdminBody(body = {}, { partial = false } = {}) {
  const details = {};
  const out = {};

  if (!partial || body.code !== undefined) out.code = normaliseCode(body.code).toUpperCase();

  if (!partial || body.discountPoisha !== undefined) {
    const discount = Number(body.discountPoisha);
    if (!Number.isInteger(discount) || discount < 1) {
      details.discountPoisha = 'Discount must be a whole number of poisha (৳1 = 100)';
    } else {
      out.discountPoisha = discount;
    }
  }

  for (const key of ['maxDiscountPoisha', 'minSpendPoisha']) {
    if (body[key] === undefined || body[key] === null || body[key] === '') continue;
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < 0) details[key] = 'Must be a whole number of poisha';
    else out[key] = value;
  }

  for (const key of ['usageLimit', 'perUserLimit']) {
    if (body[key] === undefined || body[key] === null || body[key] === '') continue;
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < 1) details[key] = 'Must be a whole number of at least 1';
    else out[key] = value;
  }

  if (body.propertyType !== undefined && body.propertyType !== null && body.propertyType !== '') {
    const type = String(body.propertyType).toUpperCase();
    if (!Object.values(PROPERTY_TYPE).includes(type)) {
      details.propertyType = `Must be one of: ${Object.values(PROPERTY_TYPE).join(', ')}`;
    } else {
      out.propertyType = type;
    }
  }

  if (body.propertyIds !== undefined) {
    if (!Array.isArray(body.propertyIds)) details.propertyIds = 'Must be a list of space ids';
    else if (body.propertyIds.some((id) => !mongoose.isValidObjectId(id))) {
      details.propertyIds = 'One of those space ids is not valid';
    } else out.propertyIds = body.propertyIds;
  }

  for (const key of ['validFrom', 'validTo']) {
    if (body[key] === undefined || body[key] === null || body[key] === '') continue;
    const date = new Date(body[key]);
    if (Number.isNaN(date.getTime())) details[key] = 'Not a valid date';
    else out[key] = date;
  }
  if (out.validFrom && out.validTo && out.validTo <= out.validFrom) {
    details.validTo = 'The end date must be after the start date';
  }

  if (body.partnerName !== undefined) out.partnerName = String(body.partnerName).trim().slice(0, 80);
  if (body.description !== undefined) out.description = String(body.description).trim().slice(0, 200);
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);

  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check the promo details', undefined, details);
  }
  return out;
}

module.exports = { normaliseCode, parseApplyBody, parseAdminBody, CASE_SENSITIVE };

/**
 * ============================================================================
 * HOST VERIFICATION & PROVISIONING — OWNER: S. Moontaha Rahman [SMR]
 * ============================================================================
 * The gate every host passes before their space can be booked.
 *
 * Nothing downstream trusts a host until this pipeline says APPROVED:
 *   [TDN] geo-search filters unverified hosts out of results
 *   [GG]  calendar refuses to create a booking against one
 *   [SMR] payout will not credit one
 *
 * That single flag is therefore the most load-bearing boolean in the project,
 * which is why approval is transactional and only an admin can set it.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { User, Host, Property } = require('../../models');
const HostVerification = require('./hostVerification.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const {
  VERIFICATION_STATUS, PROPERTY_TYPE, ROLES, NOTIFICATION_TYPE, ERROR_CODES,
} = require('../../shared/constants');
const { storeDocument } = require('./docUpload.service');
const { notify } = require('../penalty/notify.service');

const NID_MIN = Number(process.env.NID_MIN_LENGTH) || 10;

/* ------------------------------------------------------------------------ */
/* NID validation                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Bangladeshi National ID numbers come in three valid lengths:
 *   10 digits — the current smart card format
 *   13 digits — the older format without the birth year
 *   17 digits — 13 with the four-digit birth year prefixed
 * There is no public checksum or lookup API, so this is a format check, not
 * proof of identity. The admin document review is what actually verifies the
 * person — the code is honest about that rather than implying more.
 */
function validateNid(number, dateOfBirth) {
  const digits = String(number || '').replace(/\D/g, '');

  if (!digits) return { valid: false, reason: 'NID number is required' };
  if (![10, 13, 17].includes(digits.length)) {
    return { valid: false, reason: 'A Bangladeshi NID is 10, 13 or 17 digits' };
  }
  if (digits.length < NID_MIN) {
    return { valid: false, reason: `NID must be at least ${NID_MIN} digits` };
  }

  // A 17-digit NID starts with the birth year; cross-check it when we have one.
  if (digits.length === 17 && dateOfBirth) {
    const year = Number(digits.slice(0, 4));
    const dobYear = new Date(dateOfBirth).getUTCFullYear();
    if (Number.isFinite(dobYear) && year !== dobYear) {
      return { valid: false, reason: 'The NID does not match the date of birth given' };
    }
  }

  return { valid: true, normalised: digits, format: `${digits.length}-digit` };
}

/** Everything the host still has to do before submitting. */
function buildChecklist(verification) {
  const docKinds = new Set((verification.documents || []).map((d) => d.kind));
  const isMall = verification.propertyType === PROPERTY_TYPE.MALL;

  const items = [
    { key: 'NID_NUMBER', label: 'NID number', done: Boolean(verification.nid?.number) },
    { key: 'NID_FRONT', label: 'NID front photo', done: docKinds.has('NID_FRONT') },
    { key: 'NID_BACK', label: 'NID back photo', done: docKinds.has('NID_BACK') },
    {
      key: 'OWNERSHIP',
      label: isMall ? 'Trade licence' : 'Proof you control the space',
      done: isMall ? docKinds.has('TRADE_LICENCE') : docKinds.has('OWNERSHIP_PROOF'),
    },
    { key: 'SPACE_PHOTO', label: 'Photo of the space', done: docKinds.has('SPACE_PHOTO') },
  ];

  if (verification.chargerMetrics?.hasCharger) {
    items.push(
      {
        key: 'CHARGER_SPEC',
        label: 'Charger rating and connector',
        done: Boolean(verification.chargerMetrics.ratedKw && verification.chargerMetrics.connectorType),
      },
      {
        key: 'CHARGER_SAFETY',
        label: 'Earthing and RCCB confirmed',
        done: Boolean(verification.chargerMetrics.hasEarthing && verification.chargerMetrics.hasRccb),
      }
    );
  }

  const complete = items.every((i) => i.done);
  return { items, complete, remaining: items.filter((i) => !i.done).length };
}

/* ------------------------------------------------------------------------ */
/* Host-side                                                                */
/* ------------------------------------------------------------------------ */

/** Finds or creates the host's verification record. */
async function getOrCreate(hostId) {
  const host = await User.findById(hostId).lean();
  if (!host) throw ApiError.notFound('Account not found');
  if (host.role !== ROLES.HOST) throw ApiError.forbidden('Only host accounts need verification');

  let verification = await HostVerification.findOne({ hostId });
  if (!verification) {
    try {
      verification = await HostVerification.create({
        hostId,
        propertyType: host.propertyType || PROPERTY_TYPE.RESIDENTIAL,
        status: VERIFICATION_STATUS.DRAFT,
      });
    } catch (err) {
      if (err.code === 11000) verification = await HostVerification.findOne({ hostId });
      else throw err;
    }
  }
  return verification;
}

async function getMine(hostId) {
  const verification = await getOrCreate(hostId);
  const host = await User.findById(hostId).select('verificationStatus propertyType businessName').lean();

  return {
    verification,
    checklist: buildChecklist(verification),
    accountStatus: host?.verificationStatus,
    canEdit: [VERIFICATION_STATUS.DRAFT, VERIFICATION_STATUS.REJECTED].includes(verification.status),
  };
}

/** Saves the form fields. Locked once submitted, until an admin rejects it. */
async function saveDraft({ hostId, nid, ownership, chargerMetrics }) {
  const verification = await getOrCreate(hostId);

  if (![VERIFICATION_STATUS.DRAFT, VERIFICATION_STATUS.REJECTED].includes(verification.status)) {
    throw ApiError.badRequest('Your submission is under review and cannot be edited right now');
  }

  if (nid) {
    if (nid.number !== undefined) {
      const check = validateNid(nid.number, nid.dateOfBirth ?? verification.nid?.dateOfBirth);
      if (!check.valid) {
        throw ApiError.badRequest(check.reason, undefined, { 'nid.number': check.reason });
      }
      verification.nid.number = check.normalised;
    }
    if (nid.fullName !== undefined) verification.nid.fullName = String(nid.fullName).trim().slice(0, 80);
    if (nid.dateOfBirth !== undefined) {
      const dob = new Date(nid.dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        throw ApiError.badRequest('Enter a valid date of birth', undefined, {
          'nid.dateOfBirth': 'Not a valid date',
        });
      }
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) {
        throw ApiError.badRequest('Hosts must be at least 18', undefined, {
          'nid.dateOfBirth': 'You must be 18 or older to list a space',
        });
      }
      verification.nid.dateOfBirth = dob;
    }
  }

  if (ownership) {
    if (ownership.documentType !== undefined) verification.ownership.documentType = ownership.documentType;
    if (ownership.referenceNo !== undefined) {
      verification.ownership.referenceNo = String(ownership.referenceNo).trim().slice(0, 60);
    }
    if (ownership.addressMatches !== undefined) {
      verification.ownership.addressMatches = Boolean(ownership.addressMatches);
    }
  }

  if (chargerMetrics) {
    const m = verification.chargerMetrics;
    if (chargerMetrics.hasCharger !== undefined) m.hasCharger = Boolean(chargerMetrics.hasCharger);

    if (m.hasCharger) {
      if (chargerMetrics.ratedKw !== undefined) {
        const kw = Number(chargerMetrics.ratedKw);
        if (!Number.isFinite(kw) || kw <= 0 || kw > 400) {
          throw ApiError.badRequest('Enter the charger rating in kW', undefined, {
            'chargerMetrics.ratedKw': 'Must be between 0 and 400 kW',
          });
        }
        m.ratedKw = kw;
      }
      if (chargerMetrics.connectorType !== undefined) m.connectorType = chargerMetrics.connectorType;
      if (chargerMetrics.phase !== undefined) m.phase = chargerMetrics.phase;
      if (chargerMetrics.hasEarthing !== undefined) m.hasEarthing = Boolean(chargerMetrics.hasEarthing);
      if (chargerMetrics.hasRccb !== undefined) m.hasRccb = Boolean(chargerMetrics.hasRccb);
      if (chargerMetrics.meterNumber !== undefined) {
        m.meterNumber = String(chargerMetrics.meterNumber).trim().slice(0, 40);
      }
      if (chargerMetrics.overheadPoishaPerKwh !== undefined) {
        const overhead = Number(chargerMetrics.overheadPoishaPerKwh);
        if (!Number.isInteger(overhead) || overhead < 0) {
          throw ApiError.badRequest('Overhead must be a whole number of poisha per kWh', undefined, {
            'chargerMetrics.overheadPoishaPerKwh': 'Use whole poisha, e.g. 150 for ৳1.50',
          });
        }
        m.overheadPoishaPerKwh = overhead;
      }
    }
  }

  await verification.save();
  return { verification, checklist: buildChecklist(verification) };
}

/** Attaches one document. Replaces any existing document of the same kind. */
async function attachDocument({ hostId, kind, file }) {
  const ALLOWED_KINDS = ['NID_FRONT', 'NID_BACK', 'OWNERSHIP_PROOF', 'TRADE_LICENCE', 'ELECTRICAL_CERT', 'SPACE_PHOTO'];
  if (!ALLOWED_KINDS.includes(kind)) {
    throw ApiError.badRequest('Unknown document type', undefined, {
      kind: `Must be one of: ${ALLOWED_KINDS.join(', ')}`,
    });
  }

  const verification = await getOrCreate(hostId);
  if (![VERIFICATION_STATUS.DRAFT, VERIFICATION_STATUS.REJECTED].includes(verification.status)) {
    throw ApiError.badRequest('Your submission is under review and cannot be edited right now');
  }

  const stored = await storeDocument({ hostId, kind, file });

  verification.documents = [...verification.documents.filter((d) => d.kind !== kind), stored];
  await verification.save();

  return { document: stored, checklist: buildChecklist(verification) };
}

/** Hands the submission to the admin queue. */
async function submit(hostId) {
  const verification = await getOrCreate(hostId);

  if (verification.status === VERIFICATION_STATUS.APPROVED) {
    throw ApiError.badRequest('You are already verified');
  }
  if ([VERIFICATION_STATUS.SUBMITTED, VERIFICATION_STATUS.UNDER_REVIEW].includes(verification.status)) {
    throw ApiError.badRequest('Your submission is already with our team');
  }

  const checklist = buildChecklist(verification);
  if (!checklist.complete) {
    throw ApiError.badRequest(
      `${checklist.remaining} item${checklist.remaining === 1 ? '' : 's'} still to complete`,
      undefined,
      { checklist: checklist.items.filter((i) => !i.done).map((i) => i.label) }
    );
  }

  verification.status = VERIFICATION_STATUS.SUBMITTED;
  verification.submittedAt = new Date();
  verification.rejectionReason = null;
  await verification.save();

  await User.updateOne({ _id: hostId }, { $set: { verificationStatus: VERIFICATION_STATUS.SUBMITTED } });

  notify({
    userId: hostId,
    type: NOTIFICATION_TYPE.VERIFICATION,
    title: 'Verification submitted',
    body: 'We are reviewing your documents. This usually takes a day.',
    deepLink: '/host/verification',
  }).catch(() => {});

  logger.info(`[verification] host ${hostId} submitted for review`);
  return { verification, checklist };
}

/* ------------------------------------------------------------------------ */
/* Admin review                                                             */
/* ------------------------------------------------------------------------ */

async function listQueue({ status, page = 1, limit = 20 }) {
  const match = status ? { status } : { status: { $in: [VERIFICATION_STATUS.SUBMITTED, VERIFICATION_STATUS.UNDER_REVIEW] } };

  const [items, total, counts] = await Promise.all([
    HostVerification.find(match)
      .sort({ submittedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('hostId', 'name email phone propertyType businessName address createdAt')
      .lean(),
    HostVerification.countDocuments(match),
    HostVerification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    items: items.map((v) => ({ ...v, checklist: buildChecklist(v) })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  };
}

async function getOne(verificationId) {
  if (!mongoose.isValidObjectId(verificationId)) throw ApiError.badRequest('That is not a valid id');

  const verification = await HostVerification.findById(verificationId)
    .populate('hostId', 'name email phone propertyType businessName address location createdAt')
    .lean();
  if (!verification) throw ApiError.notFound('That submission no longer exists');

  return { verification, checklist: buildChecklist(verification) };
}

/**
 * Approval, transactionally. The verification record and the host's flag flip
 * together or not at all — a host marked approved without an audit trail, or
 * an approved record with an unverified host, would both be wrong.
 */
async function approve({ verificationId, adminId, notes }) {
  if (!mongoose.isValidObjectId(verificationId)) throw ApiError.badRequest('That is not a valid id');

  const verification = await HostVerification.findById(verificationId);
  if (!verification) throw ApiError.notFound('That submission no longer exists');
  if (verification.status === VERIFICATION_STATUS.APPROVED) {
    return { verification, alreadyApproved: true };
  }

  const checklist = buildChecklist(verification);
  if (!checklist.complete) {
    throw ApiError.badRequest('This submission is incomplete and cannot be approved', undefined, {
      checklist: checklist.items.filter((i) => !i.done).map((i) => i.label),
    });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      verification.status = VERIFICATION_STATUS.APPROVED;
      verification.reviewedAt = new Date();
      verification.reviewedBy = adminId;
      verification.reviewNotes = notes ? String(notes).slice(0, 600) : null;
      verification.rejectionReason = null;
      verification.nid.isVerified = true;
      await verification.save({ session });

      await User.updateOne(
        { _id: verification.hostId },
        { $set: { verificationStatus: VERIFICATION_STATUS.APPROVED, verifiedAt: new Date() } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  notify({
    userId: verification.hostId,
    type: NOTIFICATION_TYPE.VERIFICATION,
    title: 'You are verified',
    body: 'Your account is approved. You can publish your space and start taking bookings.',
    deepLink: '/host/spaces',
  }).catch(() => {});

  logger.info(`[verification] host ${verification.hostId} approved by ${adminId}`);
  return { verification, alreadyApproved: false };
}

async function reject({ verificationId, adminId, reason }) {
  if (!mongoose.isValidObjectId(verificationId)) throw ApiError.badRequest('That is not a valid id');

  const text = String(reason || '').trim();
  if (text.length < 10) {
    throw ApiError.badRequest('Tell the host what to fix', undefined, {
      reason: 'Give a reason of at least 10 characters so the host can correct it',
    });
  }

  const verification = await HostVerification.findById(verificationId);
  if (!verification) throw ApiError.notFound('That submission no longer exists');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      verification.status = VERIFICATION_STATUS.REJECTED;
      verification.reviewedAt = new Date();
      verification.reviewedBy = adminId;
      verification.rejectionReason = text.slice(0, 600);
      verification.rejectionCount += 1;
      await verification.save({ session });

      await User.updateOne(
        { _id: verification.hostId },
        { $set: { verificationStatus: VERIFICATION_STATUS.REJECTED } },
        { session }
      );

      // Unpublish their spaces — an unverified host must not stay bookable.
      await Property.updateMany(
        { hostId: verification.hostId, isPublished: true },
        { $set: { isPublished: false } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  notify({
    userId: verification.hostId,
    type: NOTIFICATION_TYPE.VERIFICATION,
    title: 'Verification needs attention',
    body: text.slice(0, 140),
    deepLink: '/host/verification',
  }).catch(() => {});

  return { verification };
}

/* ------------------------------------------------------------------------ */
/* Provisioning                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Creates a listing. Publishing is gated on approval — that gate is the whole
 * point of the pipeline, so it lives here rather than in the property routes.
 */
async function provisionProperty({ hostId, role, payload }) {
  const host = await Host.findById(hostId);
  if (!host) throw ApiError.notFound('Host account not found');

  const details = {};
  const {
    title, description, address = {}, latitude, longitude,
    entranceLatitude, entranceLongitude, entranceInstructions,
    pricePerHourPoisha, totalSlots, hasCharger, chargerSpec = {}, amenities,
  } = payload;

  if (!title || String(title).trim().length < 4) details.title = 'Give the space a name of at least 4 characters';
  if (!address.line1) details['address.line1'] = 'A street address is required';
  if (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90) details.latitude = 'A valid latitude is required';
  if (!Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180) details.longitude = 'A valid longitude is required';

  const price = Number(pricePerHourPoisha);
  if (!Number.isInteger(price) || price <= 0) {
    details.pricePerHourPoisha = 'Set an hourly price in whole poisha (৳1 = 100)';
  }
  if (Object.keys(details).length) throw ApiError.badRequest('Check the space details', undefined, details);

  const property = await Property.create({
    hostId,
    title: String(title).trim(),
    description: description ? String(description).trim().slice(0, 1000) : '',
    propertyType: host.propertyType,
    address: {
      line1: address.line1,
      area: address.area || null,
      city: address.city || 'Dhaka',
      postcode: address.postcode || null,
      landmark: address.landmark || null,
    },
    location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    ...(Number.isFinite(Number(entranceLatitude)) && Number.isFinite(Number(entranceLongitude))
      ? {
          entranceLocation: {
            type: 'Point',
            coordinates: [Number(entranceLongitude), Number(entranceLatitude)],
            instructions: entranceInstructions || null,
          },
        }
      : {}),
    pricePerHourPoisha: price,
    totalSlots: Number(totalSlots) > 0 ? Number(totalSlots) : 1,
    hasCharger: Boolean(hasCharger),
    chargerSpec: hasCharger
      ? {
          kw: Number(chargerSpec.kw) || null,
          connectorType: chargerSpec.connectorType || null,
          overheadPoishaPerKwh: Number(chargerSpec.overheadPoishaPerKwh) || 0,
        }
      : { kw: null, connectorType: null, overheadPoishaPerKwh: 0 },
    amenities: Array.isArray(amenities) ? amenities.map((a) => String(a).toUpperCase()) : [],
    isPublished: false,
  });

  logger.info(`[verification] host ${hostId} provisioned "${property.title}"`);
  return property;
}

/** Publishes or unpublishes. Publishing requires an approved host. */
async function setPublished({ propertyId, hostId, role, isPublished }) {
  if (!mongoose.isValidObjectId(propertyId)) throw ApiError.badRequest('That is not a valid space id');

  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound('That space no longer exists');
  if (String(property.hostId) !== String(hostId) && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only publish your own spaces');
  }

  if (isPublished) {
    const host = await User.findById(property.hostId).select('verificationStatus').lean();
    if (host?.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
      throw ApiError.forbidden(
        'Finish host verification before publishing this space',
        ERROR_CODES.HOST_NOT_VERIFIED
      );
    }
    if (!property.availability?.length) {
      // [GG]'s calendar owns availability; publishing without it would list a
      // space nobody can actually book.
      throw ApiError.badRequest('Open your calendar before publishing — there are no bookable hours yet', undefined, {
        availability: 'Set your weekly availability first',
      });
    }
  }

  property.isPublished = Boolean(isPublished);
  property.publishedAt = isPublished ? new Date() : property.publishedAt;
  await property.save();

  return { propertyId: property._id, isPublished: property.isPublished, title: property.title };
}

/** The host's own spaces, for the provisioning screen. */
async function listMySpaces(hostId) {
  const properties = await Property.find({ hostId })
    .select('title propertyType address isPublished pricePerHourPoisha hasCharger chargerSpec availability avgRating ratingCount')
    .sort({ createdAt: -1 })
    .lean();

  return properties.map((p) => ({
    ...p,
    hasAvailability: Boolean(p.availability?.length),
    availability: undefined,
  }));
}

module.exports = {
  validateNid,
  buildChecklist,
  getMine,
  saveDraft,
  attachDocument,
  submit,
  listQueue,
  getOne,
  approve,
  reject,
  provisionProperty,
  setPublished,
  listMySpaces,
};

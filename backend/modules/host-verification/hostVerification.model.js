/**
 * HOST VERIFICATION — OWNER: S. Moontaha Rahman [SMR]
 * Feature-local model. The shared User/Host discriminator already carries
 * `verificationStatus`; this document holds the evidence behind it.
 *
 * Document references are stored as URLs or relative paths, never as raw
 * base64 blobs — a 5 MB NID scan inside a Mongo document would blow past the
 * 16 MB BSON limit once a few are attached.
 */
const mongoose = require('mongoose');
const { VERIFICATION_STATUS, PROPERTY_TYPE, CONNECTOR_TYPE } = require('../../shared/constants');

const documentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['NID_FRONT', 'NID_BACK', 'OWNERSHIP_PROOF', 'TRADE_LICENCE', 'ELECTRICAL_CERT', 'SPACE_PHOTO'],
      required: true,
    },
    url: { type: String, required: true },
    mimeType: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
    storage: { type: String, enum: ['local', 'cloudinary'], default: 'local' },
  },
  { _id: false }
);

const hostVerificationSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    propertyType: { type: String, enum: Object.values(PROPERTY_TYPE), required: true },

    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.DRAFT,
      index: true,
    },

    /* --------------------------------------------------------- identity -- */
    nid: {
      // Bangladeshi NID numbers are 10, 13 or 17 digits.
      number: { type: String, trim: true, default: null },
      fullName: { type: String, trim: true, default: null },
      dateOfBirth: { type: Date, default: null },
      isVerified: { type: Boolean, default: false },
    },

    /* -------------------------------------------------------- ownership -- */
    ownership: {
      documentType: {
        type: String,
        enum: ['DEED', 'UTILITY_BILL', 'TENANCY_AGREEMENT', 'TRADE_LICENCE', null],
        default: null,
      },
      referenceNo: { type: String, trim: true, default: null },
      addressMatches: { type: Boolean, default: false },
    },

    /* ------------------------------------------- charger capability data -- */
    chargerMetrics: {
      hasCharger: { type: Boolean, default: false },
      ratedKw: { type: Number, min: 0, max: 400, default: null },
      connectorType: { type: String, enum: [...Object.values(CONNECTOR_TYPE), null], default: null },
      phase: { type: String, enum: ['SINGLE', 'THREE', null], default: null },
      // Safety attestations — a charger without earthing is a real hazard.
      hasEarthing: { type: Boolean, default: false },
      hasRccb: { type: Boolean, default: false },
      meterNumber: { type: String, trim: true, default: null },
      overheadPoishaPerKwh: { type: Number, default: 0, min: 0 },
    },

    documents: { type: [documentSchema], default: [] },

    /* ----------------------------------------------------------- review -- */
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNotes: { type: String, trim: true, maxlength: 600, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 600, default: null },
    rejectionCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'host_verifications' }
);

hostVerificationSchema.index({ status: 1, submittedAt: 1 });

module.exports =
  mongoose.models.HostVerification || mongoose.model('HostVerification', hostVerificationSchema);

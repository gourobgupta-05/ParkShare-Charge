/**
 * SLOT LOCK — OWNER: Gourob Gupta [GG]
 * Feature-local model. Shared schemas in backend/models are NOT redefined.
 *
 * ── THIS IS THE DOUBLE-BOOKING GUARD ──────────────────────────────────────
 * A booking is chopped into fixed 30-minute grid slots. One document is
 * inserted per slot inside the booking transaction, and the compound unique
 * index below makes a second insert for the same (property, slot) impossible.
 *
 * Why this instead of only checking for overlaps in the service layer: two
 * drivers tapping "Book" in the same millisecond both pass an overlap query,
 * because a query cannot reserve anything. A unique index can. If the second
 * insert raises E11000, the whole transaction aborts and no booking is made.
 *
 * The TTL index cleans locks up automatically once the session window has
 * passed, so the collection never grows without bound.
 */
const mongoose = require('mongoose');

const slotLockSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    /** Start of the 30-minute grid slot, UTC. */
    slotStart: { type: Date, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** TTL anchor — set to the booking end plus a grace hour. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'slot_locks' }
);

// The guard itself.
slotLockSchema.index({ propertyId: 1, slotStart: 1 }, { unique: true });
// Automatic cleanup once expiresAt passes.
slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.SlotLock || mongoose.model('SlotLock', slotLockSchema);

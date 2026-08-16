const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * STUB MODEL — NOT part of Gourob's Module 1 scope.
 * Required only so `driverId` refs in Session/Feedback resolve during
 * local testing. This belongs to the team's Registration & Login System
 * (shared workflow, not assigned to a single member in the PDF).
 *
 * DELETE THIS FILE once a real User.js exists on `main` — do not merge
 * two User models into the same branch.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, enum: ['driver', 'host', 'admin'], default: 'driver' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

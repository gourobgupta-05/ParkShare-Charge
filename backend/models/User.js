const mongoose = require('mongoose');

// Minimal placeholder — replace with the team's real shared registration
// model once merged into the main repo.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['driver', 'host', 'admin'], default: 'driver' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

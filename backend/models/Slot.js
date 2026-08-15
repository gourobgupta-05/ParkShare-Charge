const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propertyType: { type: String, enum: ['Residential', 'Mall'], required: true },
  title: { type: String, required: true, trim: true },
  address: { type: String, required: true },

  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat] — GeoJSON order
  },

  pricePerHour: { type: Number, required: true, min: 0 },
  chargerType: { type: String, enum: ['AC', 'DC Fast'], default: 'AC' },
  isAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },

  // Only meaningful when propertyType is 'Mall' — used by the Commercial
  // Mall Operating Hours Guard Worker feature.
  operatingHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '20:00' },
  },
}, { timestamps: true });

slotSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Slot', slotSchema);

/**
 * GEO SEARCH SEED — OWNER: Tamal Deb Nath [TDN]
 * Creates a verified demo host plus 8 published spaces around Dhaka so the map
 * has pins on day one. Safe to re-run: it upserts by title.
 *
 *   node modules/geo-search/geoSearch.seed.js
 */
require('../../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const { Host, Property, Wallet } = require('../../models');
const { ROLES, PROPERTY_TYPE, VERIFICATION_STATUS, CONNECTOR_TYPE } = require('../../shared/constants');
const logger = require('../../utils/logger');

const SPACES = [
  { title: 'Dhanmondi 27 covered garage',      type: 'RESIDENTIAL', lng: 90.3742, lat: 23.7465, price: 8000,  kw: 7,    conn: 'TYPE_2' },
  { title: 'Jamuna Future Park — Basement B2', type: 'MALL',        lng: 90.4249, lat: 23.8130, price: 12000, kw: 22,   conn: 'CCS2' },
  { title: 'Gulshan 2 driveway slot',          type: 'RESIDENTIAL', lng: 90.4152, lat: 23.7925, price: 15000, kw: 11,   conn: 'TYPE_2' },
  { title: 'Bashundhara City — Level 3',       type: 'MALL',        lng: 90.3896, lat: 23.7509, price: 10000, kw: 22,   conn: 'CCS2' },
  { title: 'Banani 11 garage',                 type: 'RESIDENTIAL', lng: 90.4043, lat: 23.7936, price: 9000,  kw: null, conn: null },
  { title: 'Uttara Sector 7 parking bay',      type: 'RESIDENTIAL', lng: 90.3985, lat: 23.8759, price: 6000,  kw: 7,    conn: 'GBT' },
  { title: 'Mirpur DOHS covered slot',         type: 'RESIDENTIAL', lng: 90.3648, lat: 23.8302, price: 5500,  kw: null, conn: null },
  { title: 'Police Plaza Concord — P1',        type: 'MALL',        lng: 90.4165, lat: 23.7768, price: 11000, kw: 22,   conn: 'CHADEMO' },
];

async function seed() {
  await connectDB();

  let host = await Host.findOne({ email: 'demo.host@parkshare.test' });
  if (!host) {
    host = await Host.create({
      name: 'Demo Host (seed)',
      email: 'demo.host@parkshare.test',
      phone: '01711000001',
      passwordHash: 'Password123',
      role: ROLES.HOST,
      propertyType: PROPERTY_TYPE.MALL,
      businessName: 'ParkShare Demo Properties',
      address: { line1: 'Demo Road 1', area: 'Gulshan', city: 'Dhaka' },
      location: { type: 'Point', coordinates: [90.4125, 23.8103] },
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      verifiedAt: new Date(),
      avgRating: 4.4,
      ratingCount: 26,
    });
    await Wallet.findOneAndUpdate(
      { ownerId: host._id },
      { $setOnInsert: { ownerRole: ROLES.HOST, balancePoisha: 0 } },
      { upsert: true }
    );
    logger.info('Seeded demo host (demo.host@parkshare.test / Password123)');
  } else if (host.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    host.verificationStatus = VERIFICATION_STATUS.APPROVED;
    await host.save();
  }

  for (const s of SPACES) {
    const isMall = s.type === PROPERTY_TYPE.MALL;
    await Property.findOneAndUpdate(
      { title: s.title },
      {
        hostId: host._id,
        title: s.title,
        description: isMall ? 'Secure basement parking with EV charging.' : 'Private residential slot, gated entry.',
        propertyType: s.type,
        address: { line1: s.title, area: null, city: 'Dhaka' },
        location: { type: 'Point', coordinates: [s.lng, s.lat] },
        entranceLocation: { type: 'Point', coordinates: [s.lng + 0.0002, s.lat + 0.0002], instructions: 'Main gate' },
        pricePerHourPoisha: s.price,
        totalSlots: isMall ? 25 : 1,
        hasCharger: Boolean(s.kw),
        chargerSpec: s.kw
          ? { kw: s.kw, connectorType: CONNECTOR_TYPE[s.conn], overheadPoishaPerKwh: 150 }
          : { kw: null, connectorType: null, overheadPoishaPerKwh: 0 },
        availability: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startMinute: 0, endMinute: 1440 })),
        operatingHours: isMall
          ? { is24x7: false, openMinute: 10 * 60, closeMinute: 22 * 60 } // 10:00–22:00
          : { is24x7: true, openMinute: 0, closeMinute: 1440 },
        isPublished: true,
        publishedAt: new Date(),
        amenities: isMall ? ['CCTV', 'GUARD', 'COVERED', 'LIFT_ACCESS'] : ['CCTV', 'COVERED'],
        avgRating: 4 + Math.random(),
        ratingCount: Math.floor(Math.random() * 40) + 5,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await Property.syncIndexes(); // guarantees the 2dsphere index exists
  logger.info(`Seeded ${SPACES.length} properties around Dhaka`);
  await mongoose.connection.close();
}

if (require.main === module) {
  seed().catch((err) => {
    logger.error(err.message);
    process.exit(1);
  });
}

module.exports = { seed };

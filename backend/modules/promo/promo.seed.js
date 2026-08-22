/**
 * PROMO SEED — OWNER: Maidul Islam [MI]
 * Creates the partner campaigns used in the demo, including JAMUNA20.
 *
 *   node modules/promo/promo.seed.js
 */
require('../../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');
const PromoCode = require('./promoCode.model');
const logger = require('../../utils/logger');
const { PROPERTY_TYPE } = require('../../shared/constants');

const CODES = [
  {
    code: 'JAMUNA20',
    partnerName: 'Jamuna Future Park',
    description: '৳20 off basement parking, funded by the mall',
    discountPoisha: 2000,
    minSpendPoisha: 5000,
    propertyType: PROPERTY_TYPE.MALL,
    usageLimit: 500,
    perUserLimit: 3,
  },
  {
    code: 'BASHUNDHARA50',
    partnerName: 'Bashundhara City',
    description: '৳50 off any mall bay over ৳200',
    discountPoisha: 5000,
    minSpendPoisha: 20000,
    propertyType: PROPERTY_TYPE.MALL,
    usageLimit: 200,
    perUserLimit: 1,
  },
  {
    code: 'WELCOME10',
    partnerName: 'ParkShare',
    description: '৳10 off your first booking anywhere',
    discountPoisha: 1000,
    minSpendPoisha: 0,
    propertyType: null,
    usageLimit: null,
    perUserLimit: 1,
  },
  {
    code: 'EXPIRED5',
    partnerName: 'ParkShare',
    description: 'Deliberately expired — proves the expiry path in the demo',
    discountPoisha: 500,
    propertyType: null,
    validFrom: new Date('2025-01-01'),
    validTo: new Date('2025-12-31'),
    perUserLimit: 1,
  },
];

async function seed() {
  await connectDB();

  for (const promo of CODES) {
    await PromoCode.findOneAndUpdate(
      { code: promo.code },
      { ...promo, isActive: true, usedCount: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await PromoCode.syncIndexes();
  logger.info(`Seeded ${CODES.length} promo codes (try JAMUNA20 on a mall booking)`);
  await mongoose.connection.close();
}

if (require.main === module) {
  seed().catch((err) => {
    logger.error(err.message);
    process.exit(1);
  });
}

module.exports = { seed, CODES };

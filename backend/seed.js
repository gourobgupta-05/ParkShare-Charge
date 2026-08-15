const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Slot = require('./models/Slot');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  await User.deleteOne({ email: 'test.host@parkshare.test' });
  const testHost = await User.create({
    name: 'Test Host',
    email: 'test.host@parkshare.test',
    role: 'host',
  });
  console.log('Created test host:', testHost._id.toString());

  await Slot.create({
    hostId: testHost._id,
    propertyType: 'Residential',
    title: 'Gulshan Garage Slot',
    address: 'Road 11, Gulshan 1, Dhaka',
    location: { type: 'Point', coordinates: [90.4152, 23.7925] },
    pricePerHour: 50,
  });

  await Slot.create({
    hostId: testHost._id,
    propertyType: 'Mall',
    title: 'Jamuna Future Park Charging Bay',
    address: 'Kuril, Dhaka',
    location: { type: 'Point', coordinates: [90.4245, 23.8137] },
    pricePerHour: 80,
    operatingHours: { open: '10:00', close: '20:00' },
  });

  console.log('Seeded 2 slots near Dhaka. Refresh the frontend and search nearby.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

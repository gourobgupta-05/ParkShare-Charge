const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/search', require('./routes/searchRoutes')); // Module 1

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

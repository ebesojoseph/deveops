const mongoose = require('mongoose');

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB -> ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] Connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;

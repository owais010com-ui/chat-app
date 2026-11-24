const mongoose = require('mongoose');

let memoryServer = null;

async function connectDB() {
  // Railway MongoDB plugin exposes MONGO_URL; Atlas setups typically use MONGODB_URI
  const envUri = process.env.MONGODB_URI || process.env.MONGO_URL;

  if (envUri) {
    await mongoose.connect(envUri);
    console.log('Connected to MongoDB');
    return;
  }

  const localUri = 'mongodb://127.0.0.1:27017/mern-chat';

  try {
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2500 });
    console.log('Connected to local MongoDB:', localUri);
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI or MONGO_URL environment variable is required in production.');
    }

    // Convenient dev fallback when MongoDB is not installed locally
    console.log('Local MongoDB not running. Starting in-memory MongoDB for local testing...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
    console.log('Connected to in-memory MongoDB (dev fallback)');
  }
}

module.exports = { connectDB };

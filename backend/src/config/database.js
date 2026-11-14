const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medilink_lab_dev';

  if (process.env.NODE_ENV === 'test') {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || undefined,
        serverSelectionTimeoutMS: 1000,
        autoIndex: true
      });
      return mongoose.connection;
    } catch (error) {
      console.warn('Test MongoDB is unavailable; using MongoMemoryServer.', error.message);
      memoryServer = await MongoMemoryServer.create();
      await mongoose.connect(memoryServer.getUri(), {
        dbName: process.env.MONGODB_DB_NAME || undefined,
        autoIndex: true
      });
      return mongoose.connection;
    }
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    return mongoose.connection;
  } catch (error) {
    console.warn('Database connection failed. Starting without MongoDB for local testing mode.');
    console.warn(error.message);
    return null;
  }
}

async function stopDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDatabase, stopDatabase };

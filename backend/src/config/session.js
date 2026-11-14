const session = require('express-session');
const { MongoStore } = require('connect-mongo');

module.exports = function buildSessionMiddleware() {
  if (process.env.NODE_ENV === 'test') {
    return session({
      secret: process.env.SESSION_SECRET || 'medilink-medication-test-secret',
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
      name: 'medilink.medication.sid',
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 60 * 60 * 1000,
        path: '/'
      }
    });
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medilink_lab_dev';
  let sessionStore;

  try {
    sessionStore = MongoStore.create({
      mongoUrl: mongoUri,
      dbName: process.env.MONGODB_DB_NAME || undefined,
      collectionName: 'medication_sessions',
      ttl: 7 * 24 * 60 * 60,
      autoRemove: 'native'
    });
  } catch (error) {
    sessionStore = undefined;
  }

  return session({
    secret: process.env.SESSION_SECRET || 'medilink-medication-dev-secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore || new session.MemoryStore(),
    name: 'medilink.medication.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000,
      path: '/'
    }
  });
};

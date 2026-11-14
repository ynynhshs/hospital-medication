require('dotenv').config();
const { StringDecoder } = require('string_decoder');
const User = require('../src/models/User');
const { connectDatabase, stopDatabase } = require('../src/config/database');
const { hashPassword } = require('../src/utils/password');

const roles = new Set(['nurse', 'prescriber', 'pharmacist', 'medication_admin', 'medication_auditor']);

function getLocalDatabaseName() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medilink_lab_dev';
  const parsedUri = new URL(uri);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUri.hostname)) {
    throw new Error('Local user setup only supports a MongoDB server on this computer.');
  }

  const uriDatabaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
  const databaseName = process.env.MONGODB_DB_NAME || uriDatabaseName;
  if (!databaseName) {
    throw new Error('Set MONGODB_DB_NAME or include a database name in MONGODB_URI.');
  }
  return databaseName;
}

function prompt(label, { secret = false } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command from an interactive terminal.'));
  }

  process.stdout.write(`${label}: `);
  return new Promise((resolve, reject) => {
    let value = '';
    const decoder = new StringDecoder('utf8');

    function finish(error) {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    }

    function onData(buffer) {
      for (const character of decoder.write(buffer)) {
        if (character === '\u0003') {
          finish(new Error('Account setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          const characters = Array.from(value);
          if (characters.length > 0) {
            characters.pop();
            value = characters.join('');
            process.stdout.write('\b \b');
          }
          continue;
        }
        value += character;
        process.stdout.write(secret ? '*' : character);
      }
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function promptRequired(label, options) {
  const value = (await prompt(label, options)).trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local account setup is disabled when NODE_ENV=production.');
  }
  if (process.env.ALLOW_LOCAL_USER_BOOTSTRAP !== '1') {
    throw new Error('Set ALLOW_LOCAL_USER_BOOTSTRAP=1 for this command only to enable local account setup.');
  }

  const databaseName = getLocalDatabaseName();
  console.log(`This will create an active user in the local "${databaseName}" database.`);
  const confirmation = await prompt('Type the database name to continue');
  if (confirmation !== databaseName) throw new Error('Database confirmation did not match.');

  const connection = await connectDatabase();
  if (!connection || connection.readyState !== 1) {
    throw new Error('Could not connect to the configured local MongoDB database.');
  }
  const firstName = await promptRequired('First name');
  const lastName = await promptRequired('Last name');
  const employeeId = await promptRequired('Employee ID');
  const username = await promptRequired('Username');
  const email = await promptRequired('Email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const role = await promptRequired(`Role (${Array.from(roles).join(', ')})`);
  if (!roles.has(role)) throw new Error('Role is not supported.');

  const password = await prompt('Password (minimum 12 characters)', { secret: true });
  if (password.length < 12) throw new Error('Password must be at least 12 characters.');
  const passwordConfirmation = await prompt('Confirm password', { secret: true });
  if (password !== passwordConfirmation) throw new Error('Passwords do not match.');

  const existingUser = await User.findOne({
    $or: [{ employeeId }, { username }, { email }]
  }).select('_id');
  if (existingUser) throw new Error('An account already uses that employee ID, username, or email.');

  await User.create({
    firstName,
    lastName,
    employeeId,
    username,
    email,
    passwordHash: await hashPassword(password),
    role,
    status: 'Active'
  });
  console.log(`Created active ${role} account "${username}" in "${databaseName}".`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Account setup failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(stopDatabase);
}

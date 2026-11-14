require('dotenv').config();
const mongoose = require('mongoose');

const sharedDatabaseName = 'medilink_lab_dev';
const localSourceUri = process.env.MONGODB_SOURCE_URI || 'mongodb://127.0.0.1:27017/medilink_lab_dev';
const sourceDatabaseName = process.env.MONGODB_SOURCE_DB_NAME || 'medilink_lab_dev';
const targetUri = process.env.MONGODB_URI;
const patientLinkedCollections = [
  'medicationOrders',
  'medicationSchedules',
  'medicationAdministrations',
  'medicationExceptions',
  'medicationReconciliations',
  'medicationAlerts'
];
const transferableCollections = [
  { name: 'users', uniqueFields: ['username', 'email', 'employeeId'], normalize: normalizeUser },
  { name: 'medicationCatalog', uniqueFields: ['medicationCode'] },
  { name: 'settings', uniqueFields: ['key'] },
  { name: 'auditlogs', uniqueFields: [] }
];

function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

function getConnectionDetails(uri, databaseName) {
  const parsed = new URL(uri);
  const name = databaseName || decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  return { parsed, databaseName: name };
}

function normalizeUser(sourceUser) {
  const user = { ...sourceUser };
  user.status = user.status || user.Status;
  user.createdAt = user.createdAt || new Date();
  user.updatedAt = user.updatedAt || user.updateAt || user.createdAt;
  user.__v = Number.isInteger(user.__v) ? user.__v : 0;
  delete user.Status;
  delete user.updateAt;

  if (
    !user.firstName || !user.lastName || !user.employeeId || !user.username ||
    !user.email || !user.passwordHash || !user.role || !user.status
  ) {
    throw new Error('A local user is missing required shared-user fields; migration stopped before writing.');
  }
  return user;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findConflict(collection, document, uniqueFields) {
  if (await collection.findOne({ _id: document._id }, { projection: { _id: 1 } })) return '_id';

  for (const field of uniqueFields) {
    const value = document[field];
    if (value == null || value === '') continue;
    const queryValue = typeof value === 'string'
      ? { $regex: `^${escapeRegex(value)}$`, $options: 'i' }
      : value;
    if (await collection.findOne({ [field]: queryValue }, { projection: { _id: 1 } })) return field;
  }
  return null;
}

function parseArguments(args) {
  const apply = args.includes('--apply');
  const confirmIndex = args.indexOf('--confirm');
  const confirmation = confirmIndex >= 0 ? args[confirmIndex + 1] : '';
  const acceptedArguments = new Set(['--apply', '--dry-run', '--confirm', confirmation]);
  if (args.some((argument) => !acceptedArguments.has(argument))) {
    throw new Error('Use --dry-run or --apply --confirm medilink_lab_dev.');
  }
  if (args.includes('--dry-run') && apply) throw new Error('Choose either --dry-run or --apply.');
  if (apply && confirmation !== sharedDatabaseName) {
    throw new Error('Apply requires --confirm medilink_lab_dev.');
  }
  if (!apply && confirmIndex >= 0) throw new Error('--confirm is only valid with --apply.');
  return { apply };
}

async function main() {
  const { apply } = parseArguments(process.argv.slice(2));
  if (!targetUri) throw new Error('Set MONGODB_URI locally to the Atlas connection string; do not pass it on the command line.');
  if (process.env.NODE_ENV === 'production') throw new Error('Run this migration only from a controlled development environment.');

  const source = getConnectionDetails(localSourceUri, sourceDatabaseName);
  let target;
  try {
    const parsedTargetUri = new URL(targetUri);
    const targetDatabaseName = process.env.MONGODB_DB_NAME || decodeURIComponent(parsedTargetUri.pathname.replace(/^\/+/, ''));
    target = getConnectionDetails(targetUri, targetDatabaseName);
  } catch (error) {
    throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  }
  if (!isLocalHost(source.parsed.hostname) || source.databaseName !== sharedDatabaseName) {
    throw new Error('The migration source must be the local medilink_lab_dev database.');
  }
  if (isLocalHost(target.parsed.hostname) || target.databaseName !== sharedDatabaseName) {
    throw new Error('The target must be the configured remote medilink_lab_dev database.');
  }
  if (!target.parsed.hostname.endsWith('.mongodb.net')) {
    throw new Error('The target host is not a MongoDB Atlas host.');
  }

  let sourceConnection;
  let targetConnection;
  try {
    try {
      sourceConnection = await mongoose.createConnection(source.parsed.href, {
        dbName: source.databaseName,
        serverSelectionTimeoutMS: 5000,
        autoIndex: false
      }).asPromise();
    } catch (error) {
      throw new Error('Could not connect to the local source database.');
    }

    try {
      targetConnection = await mongoose.createConnection(target.parsed.href, {
        dbName: target.databaseName,
        serverSelectionTimeoutMS: 10000,
        autoIndex: false
      }).asPromise();
    } catch (error) {
      throw new Error('Could not connect to Atlas. Check the local URI, credentials, and Atlas network access list.');
    }

    const sourceDb = sourceConnection.db;
    const targetDb = targetConnection.db;
    const mode = apply ? 'APPLY' : 'DRY RUN';
    console.log(`${mode}: target database ${target.databaseName} on ${target.parsed.hostname}.`);
    console.log('The existing Atlas patients collection will not be copied or modified.');

    const patientLinkedCounts = {};
    for (const name of patientLinkedCollections) {
      patientLinkedCounts[name] = await sourceDb.collection(name).countDocuments();
    }
    console.log(`Patient-linked local collections will remain local: ${JSON.stringify(patientLinkedCounts)}`);

    for (const descriptor of transferableCollections) {
      const sourceDocuments = await sourceDb.collection(descriptor.name).find({}).toArray();
      const targetCollection = targetDb.collection(descriptor.name);
      let planned = 0;
      let skipped = 0;
      const conflicts = {};

      for (const sourceDocument of sourceDocuments) {
        const document = descriptor.normalize ? descriptor.normalize(sourceDocument) : sourceDocument;
        const conflictField = await findConflict(targetCollection, document, descriptor.uniqueFields);
        if (conflictField) {
          skipped += 1;
          conflicts[conflictField] = (conflicts[conflictField] || 0) + 1;
          continue;
        }

        planned += 1;
        if (apply) {
          try {
            await targetCollection.insertOne(document);
          } catch (error) {
            if (error.code === 11000) {
              skipped += 1;
              planned -= 1;
              conflicts.duplicateKey = (conflicts.duplicateKey || 0) + 1;
              continue;
            }
            throw error;
          }
        }
      }

      console.log(`${descriptor.name}: ${apply ? 'inserted' : 'would insert'} ${planned}; skipped ${skipped}; conflicts ${JSON.stringify(conflicts)}.`);
    }

    if (!apply) console.log('No Atlas data was changed. Review the counts, then rerun with --apply --confirm medilink_lab_dev.');
    else console.log('Migration finished. Existing Atlas records were not overwritten.');
  } finally {
    if (targetConnection) await targetConnection.close();
    if (sourceConnection) await sourceConnection.close();
  }
}

main().catch((error) => {
  console.error(`Shared database migration failed: ${error.message}`);
  process.exitCode = 1;
});

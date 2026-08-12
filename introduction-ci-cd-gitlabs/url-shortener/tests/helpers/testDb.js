const mongoose = require('mongoose');

let mongod;

/**
 * Connects mongoose to a MongoDB instance for the test run and returns the
 * connection URI (needed to also configure connect-mongo for the session
 * store, since it manages its own connection).
 *
 * Two modes, chosen automatically:
 *  - If TEST_MONGO_URI is set (e.g. a `mongo:` service container in CI),
 *    connect straight to it. This avoids downloading a MongoDB binary,
 *    which many CI/sandboxed environments block on the network layer.
 *  - Otherwise, fall back to `mongodb-memory-server`, which is convenient
 *    for local development since it needs no MongoDB install at all.
 */
async function connect() {
  if (process.env.TEST_MONGO_URI) {
    const uri = process.env.TEST_MONGO_URI;
    await mongoose.connect(uri);
    return uri;
  }

  // Lazy-require so environments that always use TEST_MONGO_URI (like CI)
  // don't even need this package installed/working.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  return uri;
}

/** Wipes all collections between tests, keeping the connection open. */
async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Tears down the connection and stops the in-memory server. */
async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clearDatabase, closeDatabase };

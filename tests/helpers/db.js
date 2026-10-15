const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('../../src/models/User');
require('../../src/models/Job');
require('../../src/models/Application');

let mongod;

exports.connect = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Wait for index builds: the unique indexes and the text index are part of the behavior we test
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
};

exports.clear = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
};

exports.disconnect = async () => {
  await mongoose.disconnect();
  await mongod.stop();
};
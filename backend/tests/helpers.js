process.env.NODE_ENV = 'test';
process.env.VIEW_CHARGE = process.env.VIEW_CHARGE || '100';

const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');
const { bootstrap } = require('../services/bootstrap');
const { todayInCourt, addDays, formatDate } = require('../utils/dates');

let memoryServer;

/**
 * Connect to a throwaway database. Uses TEST_MONGO_URL if set (e.g. a local mongod),
 * otherwise starts an in-memory MongoDB via mongodb-memory-server.
 */
async function setupDb() {
  let url = process.env.TEST_MONGO_URL;
  if (!url) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    url = memoryServer.getUri('jis_test');
  }
  await mongoose.connect(url);
  await mongoose.connection.dropDatabase();
  await bootstrap({ log: () => {} });
  return request(createApp({ logRequests: false }));
}

async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

/** n-th upcoming Monday-Friday date (default calendar), as YYYY-MM-DD. */
function workingDay(n = 1) {
  let d = todayInCourt();
  let count = 0;
  while (count < n) {
    d = addDays(d, 1);
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) count += 1;
  }
  return formatDate(d);
}

function nextSunday() {
  let d = addDays(todayInCourt(), 1);
  while (d.getUTCDay() !== 0) d = addDays(d, 1);
  return formatDate(d);
}

async function login(api, username, password) {
  const res = await api.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function caseBody(overrides = {}) {
  return {
    defendantName: 'John Doe',
    defendantAddress: '1 Main Street',
    crimeType: 'Burglary',
    committedDate: '2026-01-10',
    committedLocation: 'Central Market',
    arrestingOfficer: 'Insp. Kumar',
    arrestDate: '2026-01-12',
    judgeName: 'Justice Rao',
    publicProsecutor: 'P. Sen',
    lawyerName: 'Adv. Gupta',
    startDate: '2026-02-01',
    expectedCompletionDate: '2026-12-31',
    ...overrides,
  };
}

module.exports = { setupDb, teardownDb, workingDay, nextSunday, login, auth, caseBody };

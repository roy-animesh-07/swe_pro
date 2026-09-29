const { Counter } = require('../models');

/** Atomically increment and return the next value of a named sequence. */
async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
}

async function nextCin() {
  const n = await nextSequence('cin');
  return `CIN-${String(n).padStart(6, '0')}`;
}

async function nextHearingId() {
  const n = await nextSequence('hearing');
  return `HRG-${String(n).padStart(6, '0')}`;
}

module.exports = { nextSequence, nextCin, nextHearingId };

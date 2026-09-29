const { Hearing, Case } = require('../models');
const { nextHearingId } = require('./counterService');
const { getCalendar } = require('./calendarService');
const { conflict, isDuplicateKeyError } = require('../utils/errors');

const slotTaken = () =>
  conflict('SLOT_ALREADY_BOOKED', 'The selected hearing slot is no longer available.');

/**
 * Create a SCHEDULED hearing. The (hearingDate, timeSlot) unique index is the final
 * authority on vacancy, so two concurrent bookings of one slot cannot both succeed.
 */
async function createHearing(cin, hearingDate, timeSlot) {
  const existing = await Hearing.exists({ hearingDate, timeSlot });
  if (existing) throw slotTaken();
  try {
    return await Hearing.create({
      hearingId: await nextHearingId(),
      cin,
      hearingDate,
      timeSlot,
      status: 'SCHEDULED',
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw slotTaken();
    throw err;
  }
}

/** Load a case's hearings in chronological order (history is never deleted). */
async function hearingsForCase(cin) {
  const calendar = await getCalendar();
  const order = new Map(calendar.timeSlots.map((s, i) => [s, i]));
  const list = await Hearing.find({ cin }).lean();
  return list.sort(
    (a, b) =>
      a.hearingDate - b.hearingDate ||
      (order.get(a.timeSlot) ?? 999) - (order.get(b.timeSlot) ?? 999) ||
      a.hearingId.localeCompare(b.hearingId)
  );
}

async function setCaseStatus(cin, status) {
  await Case.updateOne({ cin }, { $set: { status } });
}

module.exports = { createHearing, hearingsForCase, setCaseStatus };

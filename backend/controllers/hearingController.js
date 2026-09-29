const { Hearing, Case } = require('../models');
const { findCaseOr404 } = require('./caseController');
const { assertBookable, getAvailableSlots } = require('../services/calendarService');
const { createHearing, setCaseStatus } = require('../services/hearingService');
const { serializeHearing } = require('../services/serializers');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { requireStrings, requireDates, isNonEmptyString } = require('../utils/validate');
const { parseDateOnly, formatDate } = require('../utils/dates');

async function availability(req, res) {
  const date = parseDateOnly(req.query.date);
  if (!date) throw badRequest('INVALID_DATE', 'Query parameter "date" must be a valid YYYY-MM-DD date.');
  const availableSlots = await getAvailableSlots(date);
  res.json({ date: formatDate(date), availableSlots });
}

function assertCaseOpen(c) {
  if (c.status === 'CLOSED') throw conflict('CASE_CLOSED', 'This case is closed; hearings can no longer be changed.');
}

async function findScheduledHearingOr404(cin, hearingId) {
  const h = await Hearing.findOne({ cin, hearingId });
  if (!h) throw notFound('HEARING_NOT_FOUND', `No hearing "${hearingId}" for case ${cin}.`);
  if (h.status !== 'SCHEDULED') {
    throw conflict('INVALID_HEARING_STATE', `Hearing ${hearingId} is already ${h.status.toLowerCase()}.`);
  }
  return h;
}

/** POST /cases/:cin/hearings — assign a hearing date/slot. */
async function scheduleHearing(req, res) {
  const c = await findCaseOr404(req.params.cin);
  const { timeSlot } = requireStrings(req.body, ['timeSlot']);
  const { hearingDate } = requireDates(req.body, ['hearingDate']);

  assertCaseOpen(c);
  if (await Hearing.exists({ cin: c.cin, status: 'SCHEDULED' })) {
    throw conflict('HEARING_ALREADY_SCHEDULED', 'This case already has an upcoming hearing.');
  }
  await assertBookable(hearingDate, timeSlot); // re-checked server-side; UI availability is a preview only
  const hearing = await createHearing(c.cin, hearingDate, timeSlot);
  await setCaseStatus(c.cin, 'HEARING_SCHEDULED');
  res.status(201).json(serializeHearing(hearing));
}

/** POST /cases/:cin/hearings/:hearingId/adjourn — keep old record, store reason, book new hearing. */
async function adjournHearing(req, res) {
  const c = await findCaseOr404(req.params.cin);
  const { reason, newTimeSlot } = requireStrings(req.body, ['reason', 'newTimeSlot']);
  const { newHearingDate } = requireDates(req.body, ['newHearingDate']);

  assertCaseOpen(c);
  const old = await findScheduledHearingOr404(c.cin, req.params.hearingId);
  await assertBookable(newHearingDate, newTimeSlot);

  // Book the new slot first: if it is taken, nothing has changed.
  const next = await createHearing(c.cin, newHearingDate, newTimeSlot);
  const updated = await Hearing.findOneAndUpdate(
    { _id: old._id, status: 'SCHEDULED' },
    { $set: { status: 'ADJOURNED', adjournmentReason: reason } },
    { new: true }
  );
  if (!updated) {
    await Hearing.deleteOne({ _id: next._id }); // someone else changed the hearing meanwhile
    throw conflict('INVALID_HEARING_STATE', 'The hearing was modified by another user. Reload and try again.');
  }
  await setCaseStatus(c.cin, 'HEARING_SCHEDULED');
  res.json({ adjournedHearing: serializeHearing(updated), newHearing: serializeHearing(next) });
}

/** POST /cases/:cin/hearings/:hearingId/complete — record proceedings; optionally book next hearing. */
async function completeHearing(req, res) {
  const c = await findCaseOr404(req.params.cin);
  const { proceedingsSummary } = requireStrings(req.body, ['proceedingsSummary']);
  const body = req.body || {};
  const hasNextDate = isNonEmptyString(body.nextHearingDate);
  const hasNextSlot = isNonEmptyString(body.nextTimeSlot);
  if (hasNextDate !== hasNextSlot) {
    throw badRequest('VALIDATION_ERROR', 'Provide both nextHearingDate and nextTimeSlot, or neither.');
  }

  assertCaseOpen(c);
  const hearing = await findScheduledHearingOr404(c.cin, req.params.hearingId);

  let next = null;
  if (hasNextDate) {
    const { nextHearingDate } = requireDates(body, ['nextHearingDate']);
    const nextTimeSlot = body.nextTimeSlot.trim();
    if (nextHearingDate <= hearing.hearingDate) {
      throw badRequest('INVALID_DATE_ORDER', 'The next hearing must be after the hearing being recorded.');
    }
    await assertBookable(nextHearingDate, nextTimeSlot);
    next = await createHearing(c.cin, nextHearingDate, nextTimeSlot);
  }

  const updated = await Hearing.findOneAndUpdate(
    { _id: hearing._id, status: 'SCHEDULED' },
    { $set: { status: 'COMPLETED', proceedingsSummary } },
    { new: true }
  );
  if (!updated) {
    if (next) await Hearing.deleteOne({ _id: next._id });
    throw conflict('INVALID_HEARING_STATE', 'The hearing was modified by another user. Reload and try again.');
  }
  // Case continues with a new hearing, or awaits a further hearing / judgment.
  await setCaseStatus(c.cin, next ? 'HEARING_SCHEDULED' : 'PENDING');
  const fresh = await Case.findOne({ cin: c.cin }, { status: 1 }).lean();
  res.json({
    completedHearing: serializeHearing(updated),
    nextHearing: next ? serializeHearing(next) : null,
    caseStatus: fresh.status,
  });
}

module.exports = { availability, scheduleHearing, adjournHearing, completeHearing };

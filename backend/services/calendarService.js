const { CourtCalendar, Hearing } = require('../models');
const config = require('../utils/config');
const { badRequest } = require('../utils/errors');
const { formatDate, todayInCourt } = require('../utils/dates');

/** Create the calendar document from config if none exists yet (or overwrite when reset=true). */
async function ensureCalendar({ reset = false } = {}) {
  const existing = await CourtCalendar.findById('default');
  if (existing && !reset) return existing;
  const data = { ...config.calendarSeed };
  if (existing) {
    existing.set(data);
    return existing.save();
  }
  return CourtCalendar.create({ _id: 'default', ...data });
}

async function getCalendar() {
  const cal = await CourtCalendar.findById('default').lean();
  if (cal) return cal;
  return (await ensureCalendar()).toObject();
}

function isWorkingDay(calendar, date) {
  if (!calendar.workingDays.includes(date.getUTCDay())) return false;
  return !(calendar.holidays || []).includes(formatDate(date));
}

/**
 * Validate that a hearing can be placed on `date` in `timeSlot` according to the calendar.
 * (Vacancy is enforced separately — ultimately by the unique index.)
 */
async function assertBookable(date, timeSlot, { allowPast = false } = {}) {
  const calendar = await getCalendar();
  if (!allowPast && date < todayInCourt()) {
    throw badRequest('DATE_IN_PAST', 'Hearings cannot be scheduled on a past date.');
  }
  if (!isWorkingDay(calendar, date)) {
    throw badRequest('NON_WORKING_DAY', `${formatDate(date)} is not a working day of the court.`);
  }
  if (timeSlot !== undefined && !calendar.timeSlots.includes(timeSlot)) {
    throw badRequest('INVALID_SLOT', `"${timeSlot}" is not a configured hearing slot.`);
  }
  return calendar;
}

/** Vacant slots on a working day, in calendar order. */
async function getAvailableSlots(date) {
  const calendar = await assertBookable(date, undefined, { allowPast: true });
  const taken = await Hearing.find({ hearingDate: date }, { timeSlot: 1 }).lean();
  const takenSet = new Set(taken.map((h) => h.timeSlot));
  return calendar.timeSlots.filter((s) => !takenSet.has(s));
}

module.exports = { ensureCalendar, getCalendar, isWorkingDay, assertBookable, getAvailableSlots };

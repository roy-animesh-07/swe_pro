const { Case, Hearing } = require('../models');
const { getCalendar } = require('../services/calendarService');
const { badRequest, notFound } = require('../utils/errors');
const { parseDateOnly, formatDate } = require('../utils/dates');

/** (a) Currently pending (unresolved) cases, sorted by CIN. */
async function pendingCases(_req, res) {
  const cases = await Case.find({ status: { $ne: 'CLOSED' } }).sort({ cin: 1 }).lean();
  res.json(
    cases.map((c) => ({
      startDate: formatDate(c.startDate),
      cin: c.cin,
      defendantName: c.defendantName,
      defendantAddress: c.defendantAddress,
      crimeType: c.crimeType,
      committedDate: formatDate(c.committedDate),
      committedLocation: c.committedLocation,
      lawyerName: c.lawyerName,
      publicProsecutor: c.publicProsecutor,
      judgeName: c.judgeName,
      status: c.status,
    }))
  );
}

/** (b) Cases resolved (judgment delivered) within [from, to], chronological by starting date. */
async function resolvedCases(req, res) {
  const from = parseDateOnly(req.query.from);
  const to = parseDateOnly(req.query.to);
  if (!from || !to) throw badRequest('INVALID_PERIOD', 'Query parameters "from" and "to" must be YYYY-MM-DD dates.');
  if (from > to) throw badRequest('INVALID_PERIOD', '"from" must not be after "to".');

  const cases = await Case.find({ status: 'CLOSED', judgmentDate: { $gte: from, $lte: to } })
    .sort({ startDate: 1, cin: 1 })
    .lean();
  res.json(
    cases.map((c) => ({
      startDate: formatDate(c.startDate),
      cin: c.cin,
      judgmentDate: formatDate(c.judgmentDate),
      judgeName: c.judgeName,
      judgmentSummary: c.judgmentSummary,
    }))
  );
}

/** (c) Cases coming up for hearing on a date (adjourned slots are excluded). */
async function hearingsOnDate(req, res) {
  const date = parseDateOnly(req.query.date);
  if (!date) throw badRequest('INVALID_DATE', 'Query parameter "date" must be a valid YYYY-MM-DD date.');
  const calendar = await getCalendar();
  const order = new Map(calendar.timeSlots.map((s, i) => [s, i]));
  const hearings = await Hearing.find({ hearingDate: date, status: { $ne: 'ADJOURNED' } }).lean();
  hearings.sort((a, b) => (order.get(a.timeSlot) ?? 999) - (order.get(b.timeSlot) ?? 999));
  res.json(
    hearings.map((h) => ({
      cin: h.cin,
      hearingId: h.hearingId,
      hearingDate: formatDate(h.hearingDate),
      timeSlot: h.timeSlot,
      status: h.status,
    }))
  );
}

/** (d) Status of a particular case. */
async function caseStatus(req, res) {
  const c = await Case.findOne({ cin: req.params.cin }, { cin: 1, status: 1 }).lean();
  if (!c) throw notFound('CASE_NOT_FOUND', `No case with CIN "${req.params.cin}".`);
  res.json({ cin: c.cin, status: c.status });
}

module.exports = { pendingCases, resolvedCases, hearingsOnDate, caseStatus };

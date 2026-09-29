const { formatDate } = require('../utils/dates');

function serializeCase(c) {
  if (!c) return null;
  return {
    cin: c.cin,
    defendantName: c.defendantName,
    defendantAddress: c.defendantAddress,
    crimeType: c.crimeType,
    committedDate: formatDate(c.committedDate),
    committedLocation: c.committedLocation,
    arrestingOfficer: c.arrestingOfficer,
    arrestDate: formatDate(c.arrestDate),
    judgeName: c.judgeName,
    publicProsecutor: c.publicProsecutor,
    lawyerName: c.lawyerName,
    startDate: formatDate(c.startDate),
    expectedCompletionDate: formatDate(c.expectedCompletionDate),
    status: c.status,
    judgmentDate: c.judgmentDate ? formatDate(c.judgmentDate) : null,
    judgmentSummary: c.judgmentSummary ?? null,
  };
}

function serializeHearing(h) {
  if (!h) return null;
  return {
    hearingId: h.hearingId,
    cin: h.cin,
    hearingDate: formatDate(h.hearingDate),
    timeSlot: h.timeSlot,
    proceedingsSummary: h.proceedingsSummary ?? null,
    adjournmentReason: h.adjournmentReason ?? null,
    status: h.status,
  };
}

module.exports = { serializeCase, serializeHearing };

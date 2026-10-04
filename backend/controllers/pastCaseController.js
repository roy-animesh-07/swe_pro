const { Case, ViewRecord } = require('../models');
const { hearingsForCase } = require('../services/hearingService');
const { serializeCase, serializeHearing } = require('../services/serializers');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { formatDate } = require('../utils/dates');
const config = require('../utils/config');

const SEARCH_FIELDS = [
  'cin',
  'defendantName',
  'defendantAddress',
  'crimeType',
  'committedLocation',
  'arrestingOfficer',
  'judgeName',
  'publicProsecutor',
  'lawyerName',
  'judgmentSummary',
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /past-cases/search?keyword=...
 * Every whitespace-separated keyword must match at least one case field (case-insensitive).
 * Only identifying fields are returned — full details require the (charged) view endpoint.
 */
async function search(req, res) {
  const raw = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
  if (!raw) throw badRequest('VALIDATION_ERROR', 'Query parameter "keyword" is required.');
  const words = raw.split(/\s+/).slice(0, 10);

  const filter = {
    status: 'CLOSED',
    $and: words.map((w) => {
      const re = new RegExp(escapeRegex(w), 'i');
      return { $or: SEARCH_FIELDS.map((f) => ({ [f]: re })) };
    }),
  };
  const cases = await Case.find(filter).sort({ judgmentDate: -1, cin: 1 }).limit(200).lean();
  res.json(
    cases.map((c) => ({
      cin: c.cin,
      defendantName: c.defendantName,
      crimeType: c.crimeType,
      startDate: formatDate(c.startDate),
      judgmentDate: formatDate(c.judgmentDate),
      judgeName: c.judgeName,
    }))
  );
}

/**
 * POST /past-cases/:cin/view
 * Judges view free of charge. Every successful lawyer view is recorded (and charged)
 * BEFORE the details are returned — if recording fails, no details are released.
 */
async function view(req, res) {
  const c = await Case.findOne({ cin: req.params.cin }).lean();
  if (!c) throw notFound('CASE_NOT_FOUND', `No case with CIN "${req.params.cin}".`);
  if (c.status !== 'CLOSED') {
    throw conflict('NOT_AN_OLD_CASE', 'Only closed (old) cases can be viewed here.');
  }

  let charge = null;
  let viewCount;
  if (req.user.role === 'LAWYER') {
    charge = config.viewCharge;
    await ViewRecord.create({
      lawyerUsername: req.user.username,
      cin: c.cin,
      viewedAt: new Date(),
      charge,
    });
    viewCount = await ViewRecord.countDocuments({ lawyerUsername: req.user.username });
  }

  const hearings = await hearingsForCase(c.cin);
  const body = { case: { ...serializeCase(c), hearings: hearings.map(serializeHearing) }, charge };
  if (viewCount !== undefined) body.viewCount = viewCount;
  res.json(body);
}

async function getOutstandingCharge(req, res) {
  const records = await ViewRecord.find({ lawyerUsername: req.user.username, isCleared: false }).lean();
  const total = records.reduce((sum, r) => sum + r.charge, 0);
  res.json({ total });
}

async function clearCharges(req, res) {
  await ViewRecord.updateMany(
    { lawyerUsername: req.user.username, isCleared: false },
    { $set: { isCleared: true } }
  );
  res.json({ message: 'Charges cleared' });
}

module.exports = { search, view, getOutstandingCharge, clearCharges };

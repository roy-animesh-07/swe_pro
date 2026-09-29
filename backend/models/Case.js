const mongoose = require('mongoose');

const CASE_STATUSES = ['REGISTERED', 'HEARING_SCHEDULED', 'PENDING', 'CLOSED'];

const caseSchema = new mongoose.Schema(
  {
    cin: { type: String, required: true, unique: true },
    defendantName: { type: String, required: true },
    defendantAddress: { type: String, required: true },
    crimeType: { type: String, required: true },
    committedDate: { type: Date, required: true },
    committedLocation: { type: String, required: true },
    arrestingOfficer: { type: String, required: true },
    arrestDate: { type: Date, required: true },
    judgeName: { type: String, required: true },
    publicProsecutor: { type: String, required: true },
    lawyerName: { type: String, required: true },
    startDate: { type: Date, required: true },
    expectedCompletionDate: { type: Date, required: true },
    status: { type: String, required: true, enum: CASE_STATUSES, default: 'REGISTERED' },
    judgmentDate: { type: Date, default: null },
    judgmentSummary: { type: String, default: null },
  },
  { collection: 'cases', timestamps: true }
);

caseSchema.index({ status: 1, cin: 1 });
caseSchema.index({ status: 1, judgmentDate: 1 });

module.exports = mongoose.model('Case', caseSchema);
module.exports.CASE_STATUSES = CASE_STATUSES;

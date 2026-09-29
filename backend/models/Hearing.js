const mongoose = require('mongoose');

const HEARING_STATUSES = ['SCHEDULED', 'ADJOURNED', 'COMPLETED'];

const hearingSchema = new mongoose.Schema(
  {
    hearingId: { type: String, required: true, unique: true },
    cin: { type: String, required: true, index: true },
    hearingDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    proceedingsSummary: { type: String, default: null },
    adjournmentReason: { type: String, default: null },
    status: { type: String, required: true, enum: HEARING_STATUSES, default: 'SCHEDULED' },
  },
  { collection: 'hearings', timestamps: true }
);

// One slot can never be assigned to two hearings (spec §7).
hearingSchema.index({ hearingDate: 1, timeSlot: 1 }, { unique: true });

module.exports = mongoose.model('Hearing', hearingSchema);
module.exports.HEARING_STATUSES = HEARING_STATUSES;

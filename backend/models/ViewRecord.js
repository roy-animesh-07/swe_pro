const mongoose = require('mongoose');

// One record per successful lawyer view of an old case.
// The count of records per lawyer is that lawyer's old-case view count.
const viewRecordSchema = new mongoose.Schema(
  {
    lawyerUsername: { type: String, required: true, index: true },
    cin: { type: String, required: true },
    viewedAt: { type: Date, required: true, default: Date.now },
    charge: { type: Number, required: true },
    isCleared: { type: Boolean, default: false },
  },
  { collection: 'view_records' }
);

module.exports = mongoose.model('ViewRecord', viewRecordSchema);

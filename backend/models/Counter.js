const mongoose = require('mongoose');

// Atomic sequence counters used for CIN and hearing ID generation.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters' }
);

module.exports = mongoose.model('Counter', counterSchema);

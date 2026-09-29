const mongoose = require('mongoose');

// Login sessions. Only a SHA-256 hash of the bearer token is stored.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    username: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'sessions', timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);

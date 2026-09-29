const crypto = require('crypto');
const { Session, User } = require('../models');
const { unauthorized, forbidden } = require('../utils/errors');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Resolve the bearer token to a live session and an existing user.
 * The user is re-read from the database on every request, so a deleted
 * account (or a changed role) takes effect immediately and a browser-side
 * role cannot be spoofed.
 */
async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw unauthorized();

  const tokenHash = hashToken(match[1]);
  const session = await Session.findOne({ tokenHash }).lean();
  if (!session || session.expiresAt < new Date()) {
    if (session) await Session.deleteOne({ _id: session._id });
    throw unauthorized('Session expired or invalid. Please log in again.');
  }
  const user = await User.findOne({ username: session.username });
  if (!user) {
    await Session.deleteMany({ username: session.username });
    throw unauthorized('Account no longer exists.');
  }
  req.user = user.toPublic();
  req.sessionTokenHash = tokenHash;
  next();
}

/** Allow only the listed roles (enforced server-side). */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires role: ${roles.join(' or ')}.`);
    }
    next();
  };
}

module.exports = { authenticate, requireRole, hashToken };

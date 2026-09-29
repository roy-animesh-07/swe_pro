const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Session } = require('../models');
const { hashToken } = require('../middleware/auth');
const { unauthorized, badRequest } = require('../utils/errors');
const { isNonEmptyString } = require('../utils/validate');
const config = require('../utils/config');

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
    throw badRequest('VALIDATION_ERROR', 'Username and password are required.');
  }
  const user = await User.findOne({ username: username.trim() });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('Invalid username or password.');

  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({
    tokenHash: hashToken(token),
    username: user.username,
    expiresAt: new Date(Date.now() + config.sessionTtlHours * 3600 * 1000),
  });
  res.json({ user: user.toPublic(), token });
}

async function logout(req, res) {
  await Session.deleteOne({ tokenHash: req.sessionTokenHash });
  res.json({ message: 'Logged out.' });
}

async function me(req, res) {
  res.json(req.user);
}

module.exports = { login, logout, me };

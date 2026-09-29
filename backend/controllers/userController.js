const bcrypt = require('bcryptjs');
const { User, Session } = require('../models');
const { ROLES } = require('../models/User');
const { badRequest, conflict, notFound, isDuplicateKeyError } = require('../utils/errors');
const { requireStrings } = require('../utils/validate');

async function listUsers(_req, res) {
  const users = await User.find({}, { username: 1, name: 1, role: 1 }).sort({ role: 1, username: 1 }).lean();
  res.json(users.map((u) => ({ username: u.username, name: u.name, role: u.role })));
}

async function createUser(req, res) {
  const { username, password, name, role } = requireStrings(req.body, ['username', 'password', 'name', 'role']);
  if (!ROLES.includes(role)) {
    throw badRequest('INVALID_ROLE', `Role must be one of: ${ROLES.join(', ')}.`);
  }
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    throw badRequest('INVALID_USERNAME', 'Username must be 3-40 characters: letters, digits, dot, dash or underscore.');
  }
  if (password.length < 6) {
    throw badRequest('WEAK_PASSWORD', 'Password must be at least 6 characters.');
  }
  if (await User.exists({ username })) {
    throw conflict('USERNAME_EXISTS', `Username "${username}" already exists.`);
  }
  try {
    const user = await User.create({ username, name, role, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json(user.toPublic());
  } catch (err) {
    if (isDuplicateKeyError(err)) throw conflict('USERNAME_EXISTS', `Username "${username}" already exists.`);
    throw err;
  }
}

async function deleteUser(req, res) {
  const { username } = req.params;
  if (username === req.user.username) {
    throw conflict('CANNOT_DELETE_SELF', 'You cannot delete the account you are logged in with.');
  }
  const result = await User.deleteOne({ username });
  if (result.deletedCount === 0) throw notFound('USER_NOT_FOUND', `User "${username}" not found.`);
  // Revoke all sessions so the deleted account is logged out everywhere.
  await Session.deleteMany({ username });
  res.status(204).end();
}

module.exports = { listUsers, createUser, deleteUser };

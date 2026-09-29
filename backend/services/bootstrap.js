const bcrypt = require('bcryptjs');
const { User, Case, Hearing, Session, ViewRecord } = require('../models');
const { ensureCalendar } = require('./calendarService');
const config = require('../utils/config');

/** Ensure indexes, the court calendar, and a first Registrar account exist. */
async function bootstrap({ log = console.log } = {}) {
  await Promise.all([
    User.init(),
    Case.init(),
    Hearing.init(),
    Session.init(),
    ViewRecord.init(),
  ]);
  await ensureCalendar();

  const count = await User.countDocuments();
  if (count === 0) {
    const { username, password, name } = config.bootstrapAdmin;
    await User.create({
      username,
      name,
      role: 'REGISTRAR',
      passwordHash: await bcrypt.hash(password, 10),
    });
    log(`[bootstrap] Created initial Registrar account "${username}". Change its password in production.`);
  }
}

module.exports = { bootstrap };

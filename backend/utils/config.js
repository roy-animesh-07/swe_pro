require('dotenv').config();

function list(value, fallback) {
  if (!value || !value.trim()) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/jis',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS) || 12,
  // Charge applied to every lawyer view of an old case (amount is not fixed by the PS).
  viewCharge: process.env.VIEW_CHARGE !== undefined ? Number(process.env.VIEW_CHARGE) : 100,
  // Timezone used to decide what "today" is when rejecting hearings in the past.
  courtTimezone: process.env.COURT_TIMEZONE || 'Asia/Kolkata',
  // Initial court calendar. Only used to seed the `court_calendar` collection when it is empty;
  // after that the stored calendar is authoritative (see `npm run seed -- --reset-calendar`).
  calendarSeed: {
    workingDays: list(process.env.COURT_WORKING_DAYS, ['1', '2', '3', '4', '5']).map(Number),
    timeSlots: list(process.env.COURT_TIME_SLOTS, [
      '10:00-11:00',
      '11:00-12:00',
      '12:00-13:00',
      '14:00-15:00',
      '15:00-16:00',
    ]),
    holidays: list(process.env.COURT_HOLIDAYS, []),
  },
  // Bootstrap registrar, created at start-up only if the users collection is empty.
  bootstrapAdmin: {
    username: process.env.ADMIN_USERNAME || 'registrar',
    password: process.env.ADMIN_PASSWORD || 'registrar123',
    name: process.env.ADMIN_NAME || 'Court Registrar',
  },
  serveFrontend: process.env.SERVE_FRONTEND_DIR || '',
};

module.exports = config;

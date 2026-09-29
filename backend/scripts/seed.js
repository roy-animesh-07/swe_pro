/*
 * Seed script.
 *   npm run seed                      -> indexes, court calendar, initial registrar
 *   npm run seed -- --reset-calendar  -> overwrite the stored calendar from COURT_* env vars
 *   npm run seed:demo                 -> also add demo judge/lawyer accounts and sample cases
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../utils/config');
const { bootstrap } = require('../services/bootstrap');
const { ensureCalendar, isWorkingDay } = require('../services/calendarService');
const { nextCin, nextHearingId } = require('../services/counterService');
const { User, Case, Hearing } = require('../models');
const { todayInCourt, addDays, parseDateOnly } = require('../utils/dates');

const args = new Set(process.argv.slice(2));

async function upsertUser(username, password, name, role) {
  if (await User.exists({ username })) return;
  await User.create({ username, name, role, passwordHash: await bcrypt.hash(password, 10) });
  console.log(`  user ${username} / ${password} (${role})`);
}

function nthWorkingDay(calendar, from, n, direction = 1) {
  let d = from;
  let count = 0;
  while (count < n) {
    d = addDays(d, direction);
    if (isWorkingDay(calendar, d)) count += 1;
  }
  return d;
}

async function addCase(fields, hearings = [], closing = null) {
  const cin = await nextCin();
  const status = closing ? 'CLOSED' : hearings.some((h) => h.status === 'SCHEDULED') ? 'HEARING_SCHEDULED' : hearings.length ? 'PENDING' : 'REGISTERED';
  await Case.create({ ...fields, cin, status, judgmentDate: closing?.judgmentDate ?? null, judgmentSummary: closing?.judgmentSummary ?? null });
  for (const h of hearings) {
    await Hearing.create({ hearingId: await nextHearingId(), cin, ...h });
  }
  console.log(`  case ${cin} (${status})`);
}

async function seedDemo() {
  if (await Case.exists({})) {
    console.log('Cases already exist - skipping demo cases.');
    return;
  }
  const calendar = await ensureCalendar();
  const [s1, s2, s3] = calendar.timeSlots;
  const today = todayInCourt();
  const past = (n) => nthWorkingDay(calendar, today, n, -1);
  const future = (n) => nthWorkingDay(calendar, today, n, 1);
  const d = parseDateOnly;

  await upsertUser('judge1', 'judge123', 'Justice A. Sharma', 'JUDGE');
  await upsertUser('lawyer1', 'lawyer123', 'Adv. R. Mehta', 'LAWYER');

  const common = { publicProsecutor: 'P. Verma', arrestingOfficer: 'Insp. K. Singh' };

  await addCase(
    { ...common, defendantName: 'Rahul Nair', defendantAddress: '12 MG Road, Pune', crimeType: 'Burglary', committedDate: d('2025-11-02'), committedLocation: 'Koregaon Park, Pune', arrestDate: d('2025-11-05'), judgeName: 'Justice A. Sharma', lawyerName: 'Adv. R. Mehta', startDate: d('2025-12-01'), expectedCompletionDate: d('2026-06-30') },
    [
      { hearingDate: past(40), timeSlot: s1, status: 'ADJOURNED', adjournmentReason: 'Defence counsel unwell.' },
      { hearingDate: past(35), timeSlot: s2, status: 'COMPLETED', proceedingsSummary: 'Prosecution evidence recorded; CCTV footage admitted.' },
      { hearingDate: past(30), timeSlot: s1, status: 'COMPLETED', proceedingsSummary: 'Final arguments heard.' },
    ],
    { judgmentDate: past(25), judgmentSummary: 'Convicted of burglary; sentenced to 2 years rigorous imprisonment. CCTV evidence decisive.' }
  );

  await addCase(
    { ...common, defendantName: 'Sunita Rao', defendantAddress: '4 Lake View, Bengaluru', crimeType: 'Fraud', committedDate: d('2025-08-14'), committedLocation: 'Indiranagar, Bengaluru', arrestDate: d('2025-08-20'), judgeName: 'Justice M. Iyer', lawyerName: 'Adv. S. Kapoor', startDate: d('2025-09-10'), expectedCompletionDate: d('2026-03-31') },
    [{ hearingDate: past(20), timeSlot: s3, status: 'COMPLETED', proceedingsSummary: 'Documentary evidence examined; accused testimony recorded.' }],
    { judgmentDate: past(15), judgmentSummary: 'Acquitted of fraud for lack of evidence; benefit of doubt given.' }
  );

  await addCase(
    { ...common, defendantName: 'Imran Qureshi', defendantAddress: '88 Park Street, Kolkata', crimeType: 'Assault', committedDate: d('2026-05-03'), committedLocation: 'Salt Lake, Kolkata', arrestDate: d('2026-05-04'), judgeName: 'Justice A. Sharma', lawyerName: 'Adv. R. Mehta', startDate: d('2026-06-01'), expectedCompletionDate: d('2026-12-31') },
    [
      { hearingDate: past(5), timeSlot: s2, status: 'COMPLETED', proceedingsSummary: 'Charges framed; witness list submitted.' },
      { hearingDate: future(3), timeSlot: s1, status: 'SCHEDULED' },
    ]
  );

  await addCase(
    { ...common, defendantName: 'Vikram Das', defendantAddress: '21 Civil Lines, Delhi', crimeType: 'Theft', committedDate: d('2026-07-12'), committedLocation: 'Karol Bagh, Delhi', arrestDate: d('2026-07-13'), judgeName: 'Justice M. Iyer', lawyerName: 'Adv. S. Kapoor', startDate: d('2026-08-01'), expectedCompletionDate: d('2027-01-31') },
    []
  );
}

async function main() {
  await mongoose.connect(config.mongoUrl);
  await bootstrap();
  if (args.has('--reset-calendar')) {
    await ensureCalendar({ reset: true });
    console.log('Court calendar reset from environment configuration.');
  }
  if (args.has('--demo')) {
    console.log('Seeding demo data...');
    await seedDemo();
  }
  console.log('Seed complete.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

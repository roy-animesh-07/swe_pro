const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, workingDay, nextSunday, login, auth, caseBody } = require('./helpers');
const { ViewRecord } = require('../models');

let api;
let reg; // registrar token
let judge;
let lawyer;

before(async () => {
  api = await setupDb();
  reg = await login(api, 'registrar', 'registrar123');
});
after(teardownDb);

async function newCase(overrides) {
  const res = await api.post('/api/cases').set(auth(reg)).send(caseBody(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function schedule(cin, hearingDate, timeSlot) {
  return api.post(`/api/cases/${cin}/hearings`).set(auth(reg)).send({ hearingDate, timeSlot });
}

async function slotsFor(date) {
  const res = await api.get(`/api/hearings/availability?date=${date}`).set(auth(reg));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.availableSlots;
}

/** Drive a case all the way to CLOSED. */
async function closedCase(overrides, judgmentSummary, dayOffset) {
  const c = await newCase(overrides);
  const date = workingDay(dayOffset);
  const [slot] = await slotsFor(date);
  const h = await schedule(c.cin, date, slot);
  assert.equal(h.status, 201, JSON.stringify(h.body));
  const done = await api
    .post(`/api/cases/${c.cin}/hearings/${h.body.hearingId}/complete`)
    .set(auth(reg))
    .send({ proceedingsSummary: 'Arguments heard.' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const closed = await api
    .post(`/api/cases/${c.cin}/close`)
    .set(auth(reg))
    .send({ judgmentDate: '2026-09-01', judgmentSummary });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  return closed.body;
}

describe('authentication', () => {
  it('rejects invalid credentials with 401', async () => {
    const res = await api.post('/api/auth/login').send({ username: 'registrar', password: 'wrong' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'NOT_AUTHENTICATED');
    assert.ok(res.body.message);
  });

  it('returns 401 without a token and /auth/me with one', async () => {
    assert.equal((await api.get('/api/auth/me')).status, 401);
    const me = await api.get('/api/auth/me').set(auth(reg));
    assert.equal(me.status, 200);
    assert.deepEqual(me.body, { username: 'registrar', name: 'Court Registrar', role: 'REGISTRAR' });
  });

  it('logout invalidates the token', async () => {
    const t = await login(api, 'registrar', 'registrar123');
    assert.equal((await api.post('/api/auth/logout').set(auth(t))).status, 200);
    assert.equal((await api.get('/api/auth/me').set(auth(t))).status, 401);
  });
});

describe('user management', () => {
  it('creates judge and lawyer accounts', async () => {
    for (const u of [
      { username: 'judge1', password: 'judge123', name: 'Justice Rao', role: 'JUDGE' },
      { username: 'lawyer1', password: 'lawyer123', name: 'Adv. Gupta', role: 'LAWYER' },
    ]) {
      const res = await api.post('/api/users').set(auth(reg)).send(u);
      assert.equal(res.status, 201);
      assert.deepEqual(res.body, { username: u.username, name: u.name, role: u.role });
      assert.equal(res.body.passwordHash, undefined);
    }
    judge = await login(api, 'judge1', 'judge123');
    lawyer = await login(api, 'lawyer1', 'lawyer123');
  });

  it('rejects a duplicate username with 409', async () => {
    const res = await api.post('/api/users').set(auth(reg)).send({ username: 'judge1', password: 'xxxxxx', name: 'X', role: 'JUDGE' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'USERNAME_EXISTS');
  });

  it('rejects invalid input with 400', async () => {
    const res = await api.post('/api/users').set(auth(reg)).send({ username: 'abc', password: 'xxxxxx', name: ' ', role: 'ADMIN' });
    assert.equal(res.status, 400);
  });

  it('forbids non-registrars from managing users (403)', async () => {
    const res = await api.post('/api/users').set(auth(judge)).send({ username: 'x1', password: 'xxxxxx', name: 'X', role: 'JUDGE' });
    assert.equal(res.status, 403);
    assert.equal((await api.delete('/api/users/judge1').set(auth(lawyer))).status, 403);
  });

  it('deletes an account; the deleted user can no longer log in or use old tokens', async () => {
    await api.post('/api/users').set(auth(reg)).send({ username: 'temp1', password: 'temp123', name: 'Temp', role: 'LAWYER' });
    const t = await login(api, 'temp1', 'temp123');
    assert.equal((await api.delete('/api/users/temp1').set(auth(reg))).status, 204);
    assert.equal((await api.post('/api/auth/login').send({ username: 'temp1', password: 'temp123' })).status, 401);
    assert.equal((await api.get('/api/auth/me').set(auth(t))).status, 401);
    assert.equal((await api.delete('/api/users/temp1').set(auth(reg))).status, 404);
  });
});

describe('case registration', () => {
  it('generates unique sequential CINs and stores all fields', async () => {
    const a = await newCase();
    const b = await newCase({ defendantName: 'Jane Roe' });
    assert.match(a.cin, /^CIN-\d{6}$/);
    assert.notEqual(a.cin, b.cin);
    assert.equal(a.status, 'REGISTERED');
    assert.equal(a.committedDate, '2026-01-10');
    assert.equal(a.judgmentDate, null);
    const got = await api.get(`/api/cases/${a.cin}`).set(auth(reg));
    assert.equal(got.status, 200);
    assert.equal(got.body.defendantName, 'John Doe');
    assert.deepEqual(got.body.hearings, []);
  });

  it('rejects a client-supplied CIN', async () => {
    const res = await api.post('/api/cases').set(auth(reg)).send(caseBody({ cin: 'CIN-999999' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'CIN_NOT_ALLOWED');
  });

  it('updates case details correctly', async () => {
    const c = await newCase({ defendantName: 'Old Name' });
    const updated = {
      ...caseBody(), // Provides all required fields with their default test values
      defendantName: 'New Name',
      expectedCompletionDate: '2026-12-31'
    };
    const res = await api.put(`/api/cases/${c.cin}`).set(auth(reg)).send(updated);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.defendantName, 'New Name');
    assert.equal(res.body.expectedCompletionDate, '2026-12-31');

    const got = await api.get(`/api/cases/${c.cin}`).set(auth(reg));
    assert.equal(got.body.defendantName, 'New Name');
    assert.equal(got.body.expectedCompletionDate, '2026-12-31');
  });

  it('rejects empty required fields and invalid dates', async () => {
    assert.equal((await api.post('/api/cases').set(auth(reg)).send(caseBody({ defendantName: '  ' }))).status, 400);
    assert.equal((await api.post('/api/cases').set(auth(reg)).send(caseBody({ startDate: '2026-02-30' }))).status, 400);
    assert.equal((await api.post('/api/cases').set(auth(reg)).send({})).status, 400);
  });

  it('ignores a client-supplied status', async () => {
    const c = await newCase({ status: 'CLOSED' });
    assert.equal(c.status, 'REGISTERED');
  });

  it('forbids judges and lawyers from registering cases', async () => {
    assert.equal((await api.post('/api/cases').set(auth(judge)).send(caseBody())).status, 403);
    assert.equal((await api.post('/api/cases').set(auth(lawyer)).send(caseBody())).status, 403);
  });

  it('returns 404 for an unknown CIN', async () => {
    assert.equal((await api.get('/api/cases/CIN-424242').set(auth(reg))).status, 404);
    assert.equal((await api.get('/api/queries/status/CIN-424242').set(auth(reg))).status, 404);
  });
});

describe('hearing scheduling', () => {
  it('rejects non-working days and invalid slots', async () => {
    const sun = nextSunday();
    const avail = await api.get(`/api/hearings/availability?date=${sun}`).set(auth(reg));
    assert.equal(avail.status, 400);
    assert.equal(avail.body.error, 'NON_WORKING_DAY');

    const c = await newCase();
    const res = await schedule(c.cin, sun, '10:00-11:00');
    assert.equal(res.status, 400);
    const bad = await schedule(c.cin, workingDay(2), '03:00-04:00');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'INVALID_SLOT');
  });

  it('removes booked slots from availability and rejects an occupied slot (409)', async () => {
    const date = workingDay(3);
    const before = await slotsFor(date);
    const c1 = await newCase();
    const c2 = await newCase();
    const ok = await schedule(c1.cin, date, before[0]);
    assert.equal(ok.status, 201);
    assert.match(ok.body.hearingId, /^HRG-\d{6}$/);
    const after = await slotsFor(date);
    assert.ok(!after.includes(before[0]));
    assert.equal(after.length, before.length - 1);

    const clash = await schedule(c2.cin, date, before[0]);
    assert.equal(clash.status, 409);
    assert.equal(clash.body.error, 'SLOT_ALREADY_BOOKED');

    const st = await api.get(`/api/queries/status/${c1.cin}`).set(auth(reg));
    assert.deepEqual(st.body, { cin: c1.cin, status: 'HEARING_SCHEDULED' });
  });

  it('only one of two concurrent bookings of the same slot succeeds', async () => {
    const date = workingDay(4);
    const [slot] = await slotsFor(date);
    const a = await newCase();
    const b = await newCase();
    const results = await Promise.all([schedule(a.cin, date, slot), schedule(b.cin, date, slot)]);
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [201, 409]);
  });

  it('does not allow a second upcoming hearing for the same case', async () => {
    const c = await newCase();
    const date = workingDay(5);
    const slots = await slotsFor(date);
    assert.equal((await schedule(c.cin, date, slots[0])).status, 201);
    const again = await schedule(c.cin, date, slots[1]);
    assert.equal(again.status, 409);
  });
});

describe('adjournment, proceedings and closure', () => {
  let cin;
  let firstHearingId;

  it('adjournment requires a reason and new date/slot', async () => {
    const c = await newCase();
    cin = c.cin;
    const date = workingDay(6);
    const [slot] = await slotsFor(date);
    const h = await schedule(cin, date, slot);
    firstHearingId = h.body.hearingId;
    const res = await api.post(`/api/cases/${cin}/hearings/${firstHearingId}/adjourn`).set(auth(reg)).send({ reason: '' });
    assert.equal(res.status, 400);
  });

  it('adjourning keeps the old hearing with its reason and books a new one', async () => {
    const date = workingDay(7);
    const [slot] = await slotsFor(date);
    const res = await api
      .post(`/api/cases/${cin}/hearings/${firstHearingId}/adjourn`)
      .set(auth(reg))
      .send({ reason: 'Witness unavailable', newHearingDate: date, newTimeSlot: slot });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.adjournedHearing.status, 'ADJOURNED');
    assert.equal(res.body.newHearing.status, 'SCHEDULED');

    const got = await api.get(`/api/cases/${cin}`).set(auth(reg));
    assert.equal(got.body.hearings.length, 2);
    const old = got.body.hearings.find((h) => h.hearingId === firstHearingId);
    assert.equal(old.status, 'ADJOURNED');
    assert.equal(old.adjournmentReason, 'Witness unavailable');
  });

  it('cannot adjourn an already-adjourned hearing', async () => {
    const date = workingDay(8);
    const [slot] = await slotsFor(date);
    const res = await api
      .post(`/api/cases/${cin}/hearings/${firstHearingId}/adjourn`)
      .set(auth(reg))
      .send({ reason: 'Again', newHearingDate: date, newTimeSlot: slot });
    assert.equal(res.status, 409);
  });

  it('adjourning to an occupied slot fails and changes nothing', async () => {
    const got = await api.get(`/api/cases/${cin}`).set(auth(reg));
    const current = got.body.hearings.find((h) => h.status === 'SCHEDULED');
    const date = workingDay(9);
    const [slot] = await slotsFor(date);
    const other = await newCase();
    assert.equal((await schedule(other.cin, date, slot)).status, 201);
    const res = await api
      .post(`/api/cases/${cin}/hearings/${current.hearingId}/adjourn`)
      .set(auth(reg))
      .send({ reason: 'x', newHearingDate: date, newTimeSlot: slot });
    assert.equal(res.status, 409);
    const again = await api.get(`/api/cases/${cin}`).set(auth(reg));
    assert.equal(again.body.hearings.find((h) => h.hearingId === current.hearingId).status, 'SCHEDULED');
  });

  it('records proceedings and schedules the next hearing when the case continues', async () => {
    const got = await api.get(`/api/cases/${cin}`).set(auth(reg));
    const current = got.body.hearings.find((h) => h.status === 'SCHEDULED');
    assert.equal(
      (await api.post(`/api/cases/${cin}/hearings/${current.hearingId}/complete`).set(auth(reg)).send({})).status,
      400
    );
    const date = workingDay(10);
    const [slot] = await slotsFor(date);
    const res = await api
      .post(`/api/cases/${cin}/hearings/${current.hearingId}/complete`)
      .set(auth(reg))
      .send({ proceedingsSummary: 'Witness examined.', nextHearingDate: date, nextTimeSlot: slot });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.completedHearing.proceedingsSummary, 'Witness examined.');
    assert.equal(res.body.nextHearing.hearingDate, date);
    assert.equal(res.body.caseStatus, 'HEARING_SCHEDULED');
  });

  it('cannot close while a hearing is outstanding', async () => {
    const res = await api.post(`/api/cases/${cin}/close`).set(auth(reg)).send({ judgmentDate: '2026-09-01', judgmentSummary: 'x' });
    assert.equal(res.status, 409);
  });

  it('records final proceedings, moving the case to PENDING', async () => {
    const got = await api.get(`/api/cases/${cin}`).set(auth(reg));
    const current = got.body.hearings.find((h) => h.status === 'SCHEDULED');
    const res = await api
      .post(`/api/cases/${cin}/hearings/${current.hearingId}/complete`)
      .set(auth(reg))
      .send({ proceedingsSummary: 'Final arguments concluded.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.caseStatus, 'PENDING');
    assert.equal(res.body.nextHearing, null);
  });

  it('requires judgment date and summary to close', async () => {
    const res = await api.post(`/api/cases/${cin}/close`).set(auth(reg)).send({ judgmentDate: '2026-09-01' });
    assert.equal(res.status, 400);
  });

  it('closes the case, keeps it and its full hearing history, and refuses a second close', async () => {
    const res = await api
      .post(`/api/cases/${cin}/close`)
      .set(auth(reg))
      .send({ judgmentDate: '2026-09-15', judgmentSummary: 'Convicted of burglary.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CLOSED');
    assert.equal(res.body.judgmentDate, '2026-09-15');

    const kept = await api.get(`/api/cases/${cin}`).set(auth(reg));
    assert.equal(kept.status, 200);
    assert.equal(kept.body.hearings.length, 3);

    const again = await api.post(`/api/cases/${cin}/close`).set(auth(reg)).send({ judgmentDate: '2026-09-15', judgmentSummary: 'x' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error, 'CASE_ALREADY_CLOSED');

    const sched = await schedule(cin, workingDay(11), '10:00-11:00');
    assert.equal(sched.status, 409);
  });
});

describe('registrar queries', () => {
  it('lists pending cases sorted by CIN, excluding closed cases', async () => {
    const res = await api.get('/api/queries/pending-cases').set(auth(reg));
    assert.equal(res.status, 200);
    const cins = res.body.map((r) => r.cin);
    assert.deepEqual(cins, [...cins].sort());
    assert.ok(res.body.every((r) => r.status !== 'CLOSED'));
    const row = res.body[0];
    for (const k of ['startDate', 'cin', 'defendantName', 'defendantAddress', 'crimeType', 'committedDate', 'committedLocation', 'lawyerName', 'publicProsecutor', 'judgeName']) {
      assert.ok(k in row, `missing ${k}`);
    }
  });

  it('lists cases resolved in a period, chronological by start date', async () => {
    await closedCase({ startDate: '2026-03-01', defendantName: 'Later Start', crimeType: 'Arson' }, 'Acquitted of arson.', 12);
    await closedCase({ startDate: '2026-01-15', defendantName: 'Earlier Start', crimeType: 'Forgery' }, 'Convicted of forgery.', 13);
    const res = await api.get('/api/queries/resolved-cases?from=2026-08-01&to=2026-09-30').set(auth(reg));
    assert.equal(res.status, 200);
    const starts = res.body.map((r) => r.startDate);
    assert.deepEqual(starts, [...starts].sort());
    assert.ok(res.body.length >= 3);
    assert.ok(res.body[0].judgmentSummary);

    const none = await api.get('/api/queries/resolved-cases?from=2020-01-01&to=2020-12-31').set(auth(reg));
    assert.deepEqual(none.body, []);
    assert.equal((await api.get('/api/queries/resolved-cases?from=2026-09-30&to=2026-01-01').set(auth(reg))).status, 400);
    assert.equal((await api.get('/api/queries/resolved-cases').set(auth(reg))).status, 400);
  });

  it('lists hearings on a date', async () => {
    const date = workingDay(14);
    const c = await newCase();
    const [slot] = await slotsFor(date);
    await schedule(c.cin, date, slot);
    const res = await api.get(`/api/queries/hearings?date=${date}`).set(auth(reg));
    assert.equal(res.status, 200);
    assert.ok(res.body.some((h) => h.cin === c.cin && h.timeSlot === slot && h.hearingDate === date));
    assert.equal((await api.get('/api/queries/hearings?date=nope').set(auth(reg))).status, 400);
  });

  it('queries are registrar-only', async () => {
    assert.equal((await api.get('/api/queries/pending-cases').set(auth(judge))).status, 403);
    assert.equal((await api.get('/api/queries/pending-cases')).status, 401);
  });
});

describe('old-case search and view charging', () => {
  it('searches closed cases by keyword (case-insensitive, multi-word)', async () => {
    const res = await api.get('/api/past-cases/search?keyword=ARSON').set(auth(judge));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].defendantName, 'Later Start');
    assert.equal(res.body[0].judgmentSummary, undefined, 'search must not expose full details');

    const multi = await api.get('/api/past-cases/search?keyword=forgery%20earlier').set(auth(lawyer));
    assert.equal(multi.body.length, 1);

    const none = await api.get('/api/past-cases/search?keyword=zzzznomatch').set(auth(lawyer));
    assert.deepEqual(none.body, []);
    assert.equal((await api.get('/api/past-cases/search?keyword=').set(auth(lawyer))).status, 400);
  });

  it('does not return open cases in search', async () => {
    const c = await newCase({ defendantName: 'Uniqueopen Person' });
    const res = await api.get('/api/past-cases/search?keyword=Uniqueopen').set(auth(judge));
    assert.deepEqual(res.body, []);
    const view = await api.post(`/api/past-cases/${c.cin}/view`).set(auth(judge));
    assert.equal(view.status, 409);
  });

  it('registrar cannot use old-case endpoints', async () => {
    assert.equal((await api.get('/api/past-cases/search?keyword=a').set(auth(reg))).status, 403);
  });

  it('judge views are free and not recorded', async () => {
    const [hit] = (await api.get('/api/past-cases/search?keyword=arson').set(auth(judge))).body;
    const res = await api.post(`/api/past-cases/${hit.cin}/view`).set(auth(judge));
    assert.equal(res.status, 200);
    assert.equal(res.body.charge, null);
    assert.equal(res.body.case.judgmentSummary, 'Acquitted of arson.');
    assert.ok(Array.isArray(res.body.case.hearings));
    assert.equal(await ViewRecord.countDocuments({}), 0);
  });

  it('every lawyer view is charged and counted', async () => {
    const [hit] = (await api.get('/api/past-cases/search?keyword=arson').set(auth(lawyer))).body;
    const v1 = await api.post(`/api/past-cases/${hit.cin}/view`).set(auth(lawyer));
    assert.equal(v1.status, 200);
    assert.equal(v1.body.charge, 100);
    assert.equal(v1.body.viewCount, 1);
    const v2 = await api.post(`/api/past-cases/${hit.cin}/view`).set(auth(lawyer));
    assert.equal(v2.body.viewCount, 2);
    assert.equal(await ViewRecord.countDocuments({ lawyerUsername: 'lawyer1' }), 2);
    assert.equal((await api.post('/api/past-cases/CIN-424242/view').set(auth(lawyer))).status, 404);
    assert.equal(await ViewRecord.countDocuments({ lawyerUsername: 'lawyer1' }), 2);
  });

  it('a lawyer cannot bypass charging via registrar case endpoints', async () => {
    const [hit] = (await api.get('/api/past-cases/search?keyword=arson').set(auth(lawyer))).body;
    assert.equal((await api.get(`/api/cases/${hit.cin}`).set(auth(lawyer))).status, 403);
    assert.equal((await api.get(`/api/queries/status/${hit.cin}`).set(auth(lawyer))).status, 403);
    assert.equal((await api.get(`/api/past-cases/${hit.cin}/view`).set(auth(lawyer))).status, 404);
  });

  it('a forged role in the request body/header does not grant access', async () => {
    const res = await api.post('/api/cases').set(auth(lawyer)).set('X-Role', 'REGISTRAR').send({ ...caseBody(), role: 'REGISTRAR' });
    assert.equal(res.status, 403);
  });
});

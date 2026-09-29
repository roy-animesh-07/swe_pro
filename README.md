# Judiciary Information System (JIS)

A court-case management system built from `docs/IMPLEMENTATION_SPEC.md` and `docs/openapi.yaml`.

- **Frontend:** React 18 + Vite (JavaScript/JSX only)
- **Backend:** Node.js + Express 5 (JavaScript only)
- **Database:** MongoDB (via Mongoose)

The repository has no TypeScript: no `.ts`/`.tsx` files, types or `tsconfig`.

---

## What it does

| Role | Can do |
|---|---|
| **Registrar** | Log in. Create and delete accounts. Register cases and get a system-generated CIN. Check vacant slots on a working day and schedule hearings. Adjourn a hearing with a reason and rebook it. Record proceedings and book the next hearing. Record the judgment and close the case. Run the four required queries. |
| **Judge** | Log in, search old (closed) cases by keyword, and view full case details at no charge. |
| **Lawyer** | Log in, search old cases, and view full details. Each view is charged and recorded, so the system keeps each lawyer's view count. |

### Case flow

```
REGISTERED ──schedule──▶ HEARING_SCHEDULED ──record proceedings──┬─ with next hearing ─▶ HEARING_SCHEDULED
                              │                                   └─ no next hearing ───▶ PENDING
                              └──adjourn (reason + new slot)──▶ HEARING_SCHEDULED
PENDING ──schedule──▶ HEARING_SCHEDULED
PENDING ──record judgment──▶ CLOSED   (kept forever and searchable as an old case)
```

- **Hearing history is never deleted.** An adjourned hearing keeps its reason and stays in the history. A completed hearing keeps its proceedings summary.
- **Slots can't be double-booked.** A unique index on `(hearingDate, timeSlot)` guarantees this, even when two registrars book at the same moment. The availability shown in the UI is only a preview: the server checks the slot again before saving it.
- **Case lifecycle is controlled by the server.** Only the server generates CINs, and it rejects a CIN sent by the client. Only the server sets case status.

---

## Quick start with Docker (recommended)

Requires Docker Desktop, or Docker Engine with Compose v2.

```bash
cp .env.example .env              # optional: change ADMIN_PASSWORD etc.
docker compose up -d --build
docker compose exec app npm run seed:demo   # optional sample data + demo judge/lawyer
```

Open **http://localhost:8080**.

| Account | Username / password |
|---|---|
| Registrar (always created on first start) | `registrar` / `registrar123` (or your `ADMIN_*` values) |
| Judge (demo seed) | `judge1` / `judge123` |
| Lawyer (demo seed) | `lawyer1` / `lawyer123` |

To stop the stack, run `docker compose down`. Data stays in the `mongo-data` volume. `docker compose down -v` also deletes the data.

---

## Local development (without Docker)

Requires **Node.js 20+** and a MongoDB 6+ server. For MongoDB you can use a local `mongod`, `docker run -p 27017:27017 mongo:7`, or a MongoDB Atlas connection string.

```bash
# 1. Backend (http://localhost:5000/api)
cd backend
cp .env.example .env          # set MONGO_URL if not local
npm install
npm run seed:demo             # optional sample data
npm run dev

# 2. Frontend (http://localhost:5173) — in a second terminal
cd frontend
npm install
npm run dev                   # proxies /api to http://localhost:5000
```

On first start, the backend creates the database indexes and the court calendar, plus the first Registrar account if no users exist.

---

## Tests

```bash
cd backend && npm test        # 38 API tests (node:test + supertest)
cd frontend && npm test       # 21 UI tests (Vitest + Testing Library)
```

By default the backend tests start a throwaway in-memory MongoDB (`mongodb-memory-server`, which downloads a `mongod` binary the first time). To use an existing server instead, run `TEST_MONGO_URL=mongodb://127.0.0.1:27017/jis_test npm test`. That database is dropped when the tests finish.

The tests cover the checklist in §16 of the spec, including:

- login and roles: valid and invalid login, 401/403 enforcement, a spoofed role header, and a deleted account being unable to log in or reuse its token
- cases: unique CIN generation, rejection of a client-supplied CIN, and required-field validation
- hearings:
  - non-working days, invalid slots and occupied slots are rejected
  - of two simultaneous bookings for one slot, exactly one succeeds
  - an adjournment keeps the old hearing
  - completing a hearing can create the next one
  - a case can't be closed while a hearing is outstanding, or closed twice
- queries: all four, including sort order
- old cases:
  - keyword search, including no results and multi-word searches
  - judge views are free
  - every lawyer view is charged and counted
  - a lawyer can't get full details through any uncharged endpoint

The frontend tests cover login, role-based page access, and the empty case form. They also check that the generated CIN is read-only, the vacant-slot display, recovery when a slot is taken meanwhile, and adjournment validation. The rest cover proceedings, closure, all four query screens, search with no results, and a lawyer view that succeeds or fails while charging.

---

## Configuration

Backend settings live in `backend/.env`, or in `.env` when using Docker Compose.

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URL` | `mongodb://127.0.0.1:27017/jis` | MongoDB connection string |
| `PORT` | `5000` | API port |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | `registrar` / `registrar123` / `Court Registrar` | First Registrar account, created only when there are no users |
| `VIEW_CHARGE` | `100` | Amount recorded for each lawyer view of an old case |
| `COURT_WORKING_DAYS` | `1,2,3,4,5` | Sitting days (0 = Sunday … 6 = Saturday) |
| `COURT_TIME_SLOTS` | `10:00-11:00,…,15:00-16:00` | Hearing slots per day |
| `COURT_HOLIDAYS` | *(empty)* | Comma-separated `YYYY-MM-DD` dates when the court does not sit |
| `COURT_TIMEZONE` | `Asia/Kolkata` | Decides "today" when rejecting hearings in the past |
| `SESSION_TTL_HOURS` | `12` | Login session lifetime |
| `CORS_ORIGIN` | `*` | Allowed origins if the UI is hosted on another domain |
| `SERVE_FRONTEND_DIR` | *(unset)* | Folder with the built UI, so the API also serves the frontend (set automatically in Docker) |

**Court calendar.** The `COURT_*` values only seed the `court_calendar` collection the first time the app starts. After that, the stored document is what counts. To apply changed env values, run:

```bash
npm run seed -- --reset-calendar
```

Frontend settings go in `frontend/.env`: `VITE_API_URL` (API origin, for when the UI is hosted separately) and `VITE_CURRENCY_SYMBOL` (default `₹`).

---

## Deployment

### Option A: any VM or VPS with Docker

1. Copy the project to the server.
2. Set a strong `ADMIN_PASSWORD` in `.env`.
3. Run `docker compose up -d --build`.
4. Put a reverse proxy with HTTPS in front of port 8080, such as Caddy, Nginx or Traefik. A one-line Caddy config:

   ```
   jis.example.com {
     reverse_proxy localhost:8080
   }
   ```

### Option B: Render (or Railway or Fly.io) with MongoDB Atlas

1. Create a free MongoDB Atlas cluster, add a database user, allow network access, and copy the connection string.
2. Push this repository to GitHub.
3. In Render, choose **New → Blueprint** and select the repository. It picks up `render.yaml`.
4. Set `MONGO_URL` to the Atlas string, ending in `/jis?retryWrites=true&w=majority`.
5. Deploy. Render builds the root `Dockerfile`, which packages the UI and API into one service, and checks `/api/health`.
6. The first Registrar password is generated. You'll find it under the service's **Environment** tab.

The same `Dockerfile` works on Railway, Fly.io, Google Cloud Run, Azure Container Apps and similar platforms. Set `MONGO_URL` and they're ready; they all pass `PORT` automatically.

### Option C: frontend and API hosted separately

1. Build the UI with `VITE_API_URL=https://your-api.example.com npm run build`.
2. Serve `frontend/dist` from any static host. Configure the host to send all routes to `index.html`, because the UI uses client-side routing.
3. Run the backend on its own, with `CORS_ORIGIN` set to the UI's origin.

### Production checklist

- Change `ADMIN_PASSWORD`, or log in and create a new Registrar, then delete the default one.
- Serve the site over HTTPS only.
- Turn on MongoDB authentication and backups. Atlas does this by default.
- Set the real court calendar through the `COURT_*` variables before first start, or reset it afterwards.

---

## API

The full contract is in `docs/openapi.yaml`. All endpoints are under `/api`. Every error uses one shape:

```json
{ "error": "SLOT_ALREADY_BOOKED", "message": "The selected hearing slot is no longer available." }
```

Status codes: `400` invalid input, `401` not logged in, `403` wrong role, `404` unknown CIN, hearing or user, and `409` for a booked slot or an invalid state change.

The implementation adds a few choices the spec leaves open:

- **Authentication.** Login returns an opaque bearer `token`. The server stores only its SHA-256 hash in `sessions`. Logging out, or deleting the user, revokes it. The user's role is re-read from the database on every request.
- **CIN and hearing IDs.** They look like `CIN-000001` and `HRG-000001`, and come from an atomic counter plus a unique index.
- **Extra endpoints:**
  - `GET /api/users` (Registrar) fills the Users page table.
  - `GET /api/health` is used by health checks.
- **Extra response fields:**
  - `POST /cases/:cin/hearings/:id/adjourn` returns `{ adjournedHearing, newHearing }`.
  - `POST /cases/:cin/hearings/:id/complete` returns `{ completedHearing, nextHearing, caseStatus }`.
  - A lawyer's `POST /past-cases/:cin/view` response adds `viewCount`, the lawyer's total recorded views.
- **What counts as pending.** Any case that isn't `CLOSED`: `REGISTERED`, `HEARING_SCHEDULED` or `PENDING`.
- **Resolved in a period.** The case is `CLOSED` and its judgment date falls within `from` to `to`, inclusive.
- **Hearings on a date.** Scheduled and completed hearings on that date, in slot order. Adjourned hearings are left out.
- **Keyword search:**
  - Only `CLOSED` cases are searched, case-insensitively.
  - Every word must match at least one of these fields: CIN, defendant, address, crime type, location, officer, judge, prosecutor, lawyer or judgment summary.
  - Search results contain only identifying fields. Full details come only from the charged `POST /past-cases/:cin/view`.
- **Closing rules.** A case can be closed only after proceedings have been recorded (status `PENDING`) and when no hearing is still scheduled. The judgment date can't be before the case's start date.
- **Scheduling rules.** Hearings can't be scheduled on past dates. Each case can have at most one upcoming hearing.

---

## Project structure

```
jis/
├── backend/
│   ├── controllers/   auth, users, cases, hearings, queries, past cases
│   ├── middleware/    authentication, role checks, error handler
│   ├── models/        User, Session, Case, Hearing, CourtCalendar, ViewRecord, Counter
│   ├── routes/        REST routes (/api/…)
│   ├── services/      CIN/ID counters, calendar & availability, hearing helpers, bootstrap
│   ├── utils/         config, dates, validation, errors
│   ├── scripts/seed.js
│   ├── tests/         API tests
│   ├── app.js         Express app
│   └── server.js      entry point
├── frontend/
│   └── src/
│       ├── components/  Layout, ProtectedRoute, SlotPicker, CaseDetails, common UI
│       ├── context/     AuthContext
│       ├── pages/       Login, registrar pages, past-case pages
│       ├── services/    api.js (REST client)
│       ├── test/        UI tests
│       ├── App.jsx
│       └── main.jsx
├── docs/              original spec + OpenAPI contract
├── Dockerfile         single image: built UI + API
├── docker-compose.yml MongoDB + app
└── render.yaml        Render blueprint
```

### MongoDB collections

- `users`: unique on `username`
- `sessions`
- `cases`: unique on `cin`
- `hearings`: unique on `hearingId`, and unique on the pair `(hearingDate, timeSlot)`
- `court_calendar`
- `view_records`
- `counters`

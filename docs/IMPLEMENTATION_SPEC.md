# Judiciary Information System (JIS)
## Minimal Implementation Specification

**Stack:** React + JavaScript + Node.js/Express + JavaScript + MongoDB

**Language requirement:** JavaScript only. Do not use TypeScript. Frontend uses `.js`/`.jsx`; backend uses `.js`. No `.ts`/`.tsx`, TypeScript types/interfaces, or TypeScript configuration.

This specification contains only requirements needed to implement the supplied JIS problem statement. Where the problem statement does not define an exact technical choice, the implementation should choose a simple consistent solution.

---

## 1. Actors

### Registrar
The Registrar is responsible for court-case data and case processing:
- login;
- create/delete user accounts;
- register cases;
- receive a system-generated unique CIN;
- check vacant hearing slots on a working day;
- assign hearing dates;
- record adjournment reason and assign a new hearing date;
- record proceedings summary and assign the next hearing date when the case continues;
- record judgment summary and close completed cases;
- run the four required queries.

### Judge
- login;
- search old cases by keywords;
- view old case details for reference.

### Lawyer
- login;
- search old cases by keywords;
- view old case details;
- be charged for each old case viewed.

The system must keep track of how many old cases each lawyer views.

---

## 2. Information stored for a case

Each case must maintain:

```text
CIN                         system-generated unique identifier
Defendant name
Defendant address
Crime type
Date crime was committed
Location crime was committed
Arresting officer
Arrest date
Presiding/attending judge
Public prosecutor
Lawyer
Case starting date
Expected completion date
Current status
Judgment date                when the case is completed
Judgment summary             when the case is completed
```

A case is not deleted when completed; its details remain available for future reference.

### Hearing information

Each hearing must maintain:

```text
Hearing ID
Case reference / CIN
Hearing date
Time slot
Proceedings summary          when the hearing takes place
Adjournment reason           when the hearing is adjourned
```

All previous hearing records must remain available so that the case history is preserved.

---

## 3. Case flow

```text
Case Registered
      |
      v
Hearing Scheduled
      |
      | hearing takes place
      v
Proceedings Recorded
      |
      +-------------------+
      | case continues    | case completed
      v                   v
Next Hearing         Judgment Recorded
Scheduled                 |
                           v
                       Case Closed
```

Required rules:

1. During registration, the server generates the CIN.
2. The Registrar asks for vacant slots for a working day and assigns one available slot.
3. An adjourned hearing stores the adjournment reason and gets a new hearing date.
4. When a hearing takes place, the Registrar stores the proceedings summary.
5. If the case continues, another hearing date is assigned.
6. When the case is completed, the Registrar records the judgment summary and closes the case.
7. Closed case data and hearing history remain stored for future reference.

A simple implementation status set is:

```text
REGISTERED
HEARING_SCHEDULED
PENDING
CLOSED
```

`PENDING` means the case is still unresolved and another hearing is required.

---

## 4. Role permissions

| Function | Registrar | Judge | Lawyer |
|---|---:|---:|---:|
| Login | ✓ | ✓ | ✓ |
| Create user account | ✓ | | |
| Delete user account | ✓ | | |
| Register case | ✓ | | |
| Check vacant hearing slots | ✓ | | |
| Schedule hearing | ✓ | | |
| Adjourn hearing | ✓ | | |
| Record proceedings | ✓ | | |
| Record judgment / close case | ✓ | | |
| Query pending cases | ✓ | | |
| Query resolved cases by period | ✓ | | |
| Query hearings by date | ✓ | | |
| Query status by CIN | ✓ | | |
| Search old cases | | ✓ | ✓ |
| View old case | | ✓ | ✓ |

Authorization must be enforced by the backend, not only by React.

---

## 5. System architecture

```text
React Frontend
      |
      | HTTP / JSON
      v
Node.js + Express Backend
      |
      +-- Authentication
      +-- Authorization
      +-- Case management
      +-- Hearing management
      +-- Required queries
      +-- Old-case search/view charging
      +-- User management
      |
      v
MongoDB
```

### Responsibilities

**React**
- pages and navigation;
- forms and tables;
- client-side input checks;
- display backend results/errors;
- call REST APIs.

**Node.js/Express**
- authentication and role checks;
- validation;
- CIN generation;
- case and hearing rules;
- queries;
- lawyer view charging/count tracking;
- database access.

**MongoDB**
- persist users, cases, hearings and lawyer old-case view records.

The client must not generate CINs, make the final decision that a slot is free, or decide a case status.

---

## 6. Project structure (JavaScript only)

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── context/
│   ├── App.jsx
│   └── main.jsx

backend/
├── models/
├── routes/
├── controllers/
├── middleware/
├── services/
├── utils/
└── server.js
```

Use normal JavaScript objects/functions instead of TypeScript interfaces or types.

---

## 7. MongoDB design

### `users`

```js
{
  username: String,       // unique
  passwordHash: String,
  name: String,
  role: "REGISTRAR" | "JUDGE" | "LAWYER"
}
```

### `cases`

```js
{
  cin: String,            // unique
  defendantName: String,
  defendantAddress: String,
  crimeType: String,
  committedDate: Date,
  committedLocation: String,
  arrestingOfficer: String,
  arrestDate: Date,
  judgeName: String,
  publicProsecutor: String,
  lawyerName: String,
  startDate: Date,
  expectedCompletionDate: Date,
  status: String,
  judgmentDate: Date | null,
  judgmentSummary: String | null
}
```

### `hearings`

```js
{
  hearingId: String,
  cin: String,
  hearingDate: Date,
  timeSlot: String,
  proceedingsSummary: String | null,
  adjournmentReason: String | null,
  status: "SCHEDULED" | "ADJOURNED" | "COMPLETED"
}
```

Use a unique database constraint for `(hearingDate, timeSlot)` so one slot cannot be assigned to two cases.

### `court_calendar`

Store the working days and available time slots used by the Registrar when checking availability. The problem statement does not prescribe particular days or times, so do not hard-code example slots into the requirements.

### `view_records`

```js
{
  lawyerUsername: String,
  cin: String,
  viewedAt: Date,
  charge: Number
}
```

Each successful lawyer view of an old case creates one record. The number of records for that lawyer is the lawyer's old-case view count.

The problem statement requires charging but does not specify the amount; the implementation may use one configured charge value.

---

## 8. CIN generation

CIN requirements:
- generated by the backend;
- unique for every case;
- never accepted from the client as the authoritative CIN.

The exact CIN format is not specified, so the implementation may choose a simple format such as `CIN-000001`.

A unique database index must enforce uniqueness.

---

## 9. Hearing scheduling

### Find vacant slots

`GET /api/hearings/availability?date=YYYY-MM-DD`

The backend:
1. checks whether the selected date is a working day;
2. gets the configured slots;
3. removes slots already assigned to hearings;
4. returns the vacant slots.

### Assign a hearing

`POST /api/cases/:cin/hearings`

The request contains the hearing date and time slot.

The backend must check the slot again before saving. The availability displayed in React is only a preview.

### Adjourn a hearing

`POST /api/cases/:cin/hearings/:hearingId/adjourn`

Store the reason on the old hearing, keep the old record, and create/assign the new hearing date and time slot.

### Complete a hearing

`POST /api/cases/:cin/hearings/:hearingId/complete`

Store the proceedings summary. If the case continues, a new hearing date/time is also supplied and scheduled.

---

## 10. Case closure

`POST /api/cases/:cin/close`

Store:
- judgment date;
- judgment summary.

Then set the case status to `CLOSED`.

A closed case must remain in MongoDB and must be searchable as an old case.

---

## 11. Required Registrar queries

### (a) Currently pending cases

`GET /api/queries/pending-cases`

Return pending cases **sorted by CIN**.

Each record must contain:

```text
case starting date
CIN
defendant name
defendant address
crime details
lawyer name
public prosecutor name
attending judge name
```

`Crime details` should include the stored crime information needed by the PS, including crime type and the committed date/location.

### (b) Cases resolved over a period

`GET /api/queries/resolved-cases?from=YYYY-MM-DD&to=YYYY-MM-DD`

Return the cases resolved during the supplied period, chronologically by case starting date.

Each record must contain:

```text
case starting date
CIN
date judgment was delivered
attending judge
judgment summary
```

### (c) Cases coming up for hearing on a date

`GET /api/queries/hearings?date=YYYY-MM-DD`

Return the hearings scheduled for that date, including at least the CIN and hearing date/time.

### (d) Status of a particular case

`GET /api/queries/status/:cin`

Return the current status of the requested CIN.

---

## 12. Old-case search and charging

### Search

`GET /api/past-cases/search?keyword=...`

Accessible to Judges and Lawyers.

The search must use keywords to find old/resolved cases.

The search result should provide enough information to identify the case, for example:

```text
CIN
Defendant name
Crime type
Starting date
Judgment date
Judge name
```

### View old case

`POST /api/past-cases/:cin/view`

Accessible to Judges and Lawyers.

**Judge:** return the old case details.

**Lawyer:**
1. verify the lawyer is logged in;
2. record one charge/view record;
3. update the lawyer's tracked view count through stored records;
4. return the old case details.

A separate uncharged endpoint must not expose the full old-case details to a lawyer.

A view of an old case means a case that has already been completed/closed.

---

## 13. Frontend pages

### Common

`/login`

Login form for all users. After authentication, show only the pages allowed for the user's role.

### Registrar

`/registrar/users` — create and delete user accounts.

`/registrar/cases/new` — register a new case and display the generated CIN after successful submission.

`/registrar/cases/:cin` — manage one case: see case data/history, schedule hearing, adjourn, record proceedings, and close the case.

`/registrar/queries/pending` — pending cases sorted by CIN.

`/registrar/queries/resolved` — resolved cases for a selected period.

`/registrar/queries/hearings` — hearings for a selected date.

`/registrar/queries/status` — status lookup by CIN.

### Judge

`/judge/past-cases` — keyword search for old cases.

`/judge/past-cases/:cin` — view selected old-case details.

### Lawyer

`/lawyer/past-cases` — keyword search for old cases.

`/lawyer/past-cases/:cin` — view selected old-case details; the backend records the charge/view.

No separate lawyer view-count page is required by the PS; the count only needs to be maintained by the system.

---

## 14. API summary

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | All | Login |
| POST | `/auth/logout` | Logged-in user | End login session |
| GET | `/auth/me` | Logged-in user | Current user/session |
| POST | `/users` | Registrar | Create account |
| DELETE | `/users/:username` | Registrar | Delete account |
| POST | `/cases` | Registrar | Register case + generate CIN |
| GET | `/cases/:cin` | Registrar | Get case/history for case management |
| GET | `/hearings/availability` | Registrar | Vacant slots |
| POST | `/cases/:cin/hearings` | Registrar | Schedule hearing |
| POST | `/cases/:cin/hearings/:hearingId/adjourn` | Registrar | Adjourn + new hearing |
| POST | `/cases/:cin/hearings/:hearingId/complete` | Registrar | Record proceedings |
| POST | `/cases/:cin/close` | Registrar | Record judgment + close |
| GET | `/queries/pending-cases` | Registrar | Pending cases |
| GET | `/queries/resolved-cases` | Registrar | Resolved cases by period |
| GET | `/queries/hearings` | Registrar | Hearing schedule by date |
| GET | `/queries/status/:cin` | Registrar | Status by CIN |
| GET | `/past-cases/search` | Judge/Lawyer | Search old cases |
| POST | `/past-cases/:cin/view` | Judge/Lawyer | View old case; charge lawyer |

`/auth/logout` and `/auth/me` are ordinary session-support endpoints; they do not add a JIS business feature.

---

## 15. Validation and errors

Validate required fields before database writes. Do not accept empty required strings.

Important checks:
- CIN supplied by the client must be ignored/rejected during registration;
- hearing date must be a working day;
- requested hearing slot must exist and be vacant;
- adjournment reason and new hearing date/time are required;
- proceedings summary is required when completing a hearing;
- judgment date and summary are required when closing a case;
- old-case viewing is allowed only for a closed case;
- unknown CIN/hearing/user returns `404`;
- wrong role returns `403`;
- unauthenticated access returns `401`;
- invalid input returns `400`;
- already-booked slot or invalid state transition returns `409`.

Use one consistent error shape:

```json
{
  "error": "SLOT_ALREADY_BOOKED",
  "message": "The selected hearing slot is no longer available."
}
```

---

## 16. Required testing

### Frontend

- valid/invalid login;
- role-based page access;
- empty/invalid case form;
- generated CIN is displayed and not editable;
- vacant-slot display;
- handling of a slot that became unavailable;
- adjournment requires reason and new date/time;
- proceedings entry;
- case closure form;
- all four Registrar query screens;
- keyword search and no-result case;
- lawyer old-case view shows backend result and handles charge failure/error.

### Backend

- create/delete user;
- reject duplicate username;
- generate unique CIN;
- reject unauthorized roles;
- register required case data;
- reject non-working or occupied hearing slots;
- preserve old hearing after adjournment;
- create next hearing when required;
- save proceedings summary;
- save judgment and close case;
- keep closed cases;
- pending-case sorting by CIN;
- resolved-case period query;
- hearing query by date;
- status query by CIN;
- keyword search of old cases;
- charge/record every successful lawyer old-case view;
- no lawyer charge for a Judge view;
- deleted account cannot log in.

### Integration / edge cases

- two users try to book the same slot;
- React shows a slot that is booked before final submission;
- invalid/unknown CIN;
- already-closed case is closed again;
- old hearing history disappears after an adjournment (must not happen);
- database/server error is shown cleanly in React;
- a lawyer cannot bypass the charging endpoint to obtain full old-case details;
- browser-side role manipulation must not bypass backend authorization.

---

## 17. Implementation order

1. MongoDB models and connection.
2. Authentication and backend role checks.
3. User create/delete.
4. Case registration and CIN generation.
5. Court calendar and hearing availability.
6. Hearing scheduling, adjournment and proceedings.
7. Judgment and case closure.
8. Four Registrar queries.
9. Old-case keyword search and lawyer charging/count tracking.
10. React pages and API integration.
11. Testing and edge-case fixes.

---

## 18. Completion checklist

The project satisfies the PS when:

- Registrar, Judge and Lawyer accounts can log in;
- Registrar can create/delete accounts;
- Registrar can register cases and get unique system-generated CINs;
- hearings use vacant working-day slots;
- adjournments and proceeding history are stored;
- completed cases store judgment details and remain available;
- all four required Registrar queries work;
- Judges and Lawyers can keyword-search old cases;
- Judges can view old cases;
- Lawyers can view old cases and are charged for each view;
- the system keeps track of each lawyer's number of old-case views;
- React, Node.js and MongoDB are integrated through the documented APIs.

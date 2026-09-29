import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api.js';
import { CaseSummary, HearingHistory } from '../../components/CaseDetails.jsx';
import SlotPicker from '../../components/SlotPicker.jsx';
import { ErrorMessage, Field, PageHeader, Spinner, SuccessMessage, formatDate } from '../../components/common.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/** Shared behaviour for action forms: busy state, errors, and slot refresh on conflicts. */
function useAction(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const run = async (fn, successMsg) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone(successMsg);
    } catch (err) {
      setError(err);
      if (err.code === 'SLOT_ALREADY_BOOKED') setRefreshKey((k) => k + 1); // show fresh availability
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, refreshKey, run };
}

function ScheduleForm({ cin, onDone }) {
  const [slot, setSlot] = useState({ date: '', slot: '' });
  const a = useAction(onDone);
  function submit(e) {
    e.preventDefault();
    if (!slot.date || !slot.slot) return a.setError('Choose a working day and a vacant slot.');
    a.run(() => api.scheduleHearing(cin, slot.date, slot.slot), `Hearing scheduled for ${formatDate(slot.date)}, ${slot.slot}.`);
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Schedule hearing</h2>
      <ErrorMessage error={a.error} />
      <SlotPicker value={slot} onChange={setSlot} refreshKey={a.refreshKey} minDate={today()} />
      <button className="btn btn-primary" disabled={a.busy}>
        {a.busy ? 'Scheduling…' : 'Assign hearing'}
      </button>
    </form>
  );
}

function ProceedingsForm({ cin, hearing, onDone }) {
  const [summary, setSummary] = useState('');
  const [continues, setContinues] = useState(true);
  const [next, setNext] = useState({ date: '', slot: '' });
  const a = useAction(onDone);
  function submit(e) {
    e.preventDefault();
    if (!summary.trim()) return a.setError('Enter the proceedings summary.');
    if (continues && (!next.date || !next.slot)) return a.setError('Choose the next hearing date and slot, or untick "case continues".');
    const body = { proceedingsSummary: summary.trim() };
    if (continues) Object.assign(body, { nextHearingDate: next.date, nextTimeSlot: next.slot });
    a.run(() => api.completeHearing(cin, hearing.hearingId, body), 'Proceedings recorded.');
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Record proceedings</h2>
      <p className="muted">
        Hearing {hearing.hearingId} · {formatDate(hearing.hearingDate)} · {hearing.timeSlot}
      </p>
      <ErrorMessage error={a.error} />
      <Field label="Proceedings summary">
        <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" checked={continues} onChange={(e) => setContinues(e.target.checked)} />
        Case continues — assign the next hearing
      </label>
      {continues && <SlotPicker label="Next hearing date" value={next} onChange={setNext} refreshKey={a.refreshKey} minDate={today()} />}
      <button className="btn btn-primary" disabled={a.busy}>
        {a.busy ? 'Saving…' : 'Save proceedings'}
      </button>
    </form>
  );
}

function AdjournForm({ cin, hearing, onDone }) {
  const [reason, setReason] = useState('');
  const [next, setNext] = useState({ date: '', slot: '' });
  const a = useAction(onDone);
  function submit(e) {
    e.preventDefault();
    if (!reason.trim()) return a.setError('An adjournment reason is required.');
    if (!next.date || !next.slot) return a.setError('Choose the new hearing date and slot.');
    a.run(
      () => api.adjournHearing(cin, hearing.hearingId, { reason: reason.trim(), newHearingDate: next.date, newTimeSlot: next.slot }),
      'Hearing adjourned and new hearing assigned.'
    );
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Adjourn hearing</h2>
      <ErrorMessage error={a.error} />
      <Field label="Adjournment reason">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <SlotPicker label="New hearing date" value={next} onChange={setNext} refreshKey={a.refreshKey} minDate={today()} />
      <button className="btn btn-warning" disabled={a.busy}>
        {a.busy ? 'Saving…' : 'Adjourn'}
      </button>
    </form>
  );
}

function CloseForm({ cin, onDone }) {
  const [judgmentDate, setJudgmentDate] = useState(today());
  const [judgmentSummary, setJudgmentSummary] = useState('');
  const a = useAction(onDone);
  function submit(e) {
    e.preventDefault();
    if (!judgmentDate || !judgmentSummary.trim()) return a.setError('Judgment date and summary are required.');
    if (!window.confirm('Record the judgment and close this case? This cannot be undone.')) return undefined;
    a.run(() => api.closeCase(cin, { judgmentDate, judgmentSummary: judgmentSummary.trim() }), 'Judgment recorded. Case closed.');
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Record judgment &amp; close case</h2>
      <ErrorMessage error={a.error} />
      <Field label="Judgment date">
        <input type="date" value={judgmentDate} onChange={(e) => setJudgmentDate(e.target.value)} />
      </Field>
      <Field label="Judgment summary">
        <textarea rows={4} value={judgmentSummary} onChange={(e) => setJudgmentSummary(e.target.value)} />
      </Field>
      <button className="btn btn-danger" disabled={a.busy}>
        {a.busy ? 'Closing…' : 'Close case'}
      </button>
    </form>
  );
}

const EDIT_FIELDS = [
  { name: 'defendantName', label: 'Defendant name' },
  { name: 'defendantAddress', label: 'Defendant address' },
  { name: 'crimeType', label: 'Crime type' },
  { name: 'committedDate', label: 'Date crime was committed', type: 'date' },
  { name: 'committedLocation', label: 'Location crime was committed' },
  { name: 'arrestingOfficer', label: 'Arresting officer' },
  { name: 'arrestDate', label: 'Arrest date', type: 'date' },
  { name: 'judgeName', label: 'Presiding judge' },
  { name: 'publicProsecutor', label: 'Public prosecutor' },
  { name: 'lawyerName', label: 'Lawyer' },
  { name: 'startDate', label: 'Case starting date', type: 'date' },
  { name: 'expectedCompletionDate', label: 'Expected completion date', type: 'date' },
];

function EditCaseForm({ data, onCancel, onDone }) {
  const [form, setForm] = useState(() => {
    const f = {};
    for (const field of EDIT_FIELDS) {
      f[field.name] = data[field.name] ? (field.type === 'date' ? data[field.name].slice(0, 10) : data[field.name]) : '';
    }
    return f;
  });
  const [errors, setErrors] = useState({});
  const a = useAction(onDone);

  function submit(e) {
    e.preventDefault();
    const errs = {};
    for (const f of EDIT_FIELDS) if (!String(form[f.name] || '').trim()) errs[f.name] = 'Required';
    if (form.committedDate && form.arrestDate && form.arrestDate < form.committedDate) {
      errs.arrestDate = 'Cannot be before the crime date';
    }
    if (form.startDate && form.expectedCompletionDate && form.expectedCompletionDate < form.startDate) {
      errs.expectedCompletionDate = 'Cannot be before the start date';
    }
    
    setErrors(errs);
    if (Object.keys(errs).length) return;
    
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    a.run(() => api.updateCase(data.cin, body), 'Case details updated.');
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Edit case details</h2>
      <ErrorMessage error={a.error} />
      <div className="form-grid">
        {EDIT_FIELDS.map((f) => (
          <Field key={f.name} label={f.label} error={errors[f.name]}>
            <input
              type={f.type || 'text'}
              name={f.name}
              value={form[f.name]}
              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <div className="actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={a.busy}>
          {a.busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={a.busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ManageCasePage() {
  const { cin } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getCase(cin));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [cin]);

  useEffect(() => {
    setData(null);
    setSuccess(null);
    load();
  }, [load]);

  const onDone = (msg) => {
    setSuccess(msg);
    setIsEditing(false);
    load();
  };

  if (error && !data) {
    return (
      <>
        <PageHeader title={`Case ${cin}`} />
        <ErrorMessage error={error} />
        <OpenCaseForm />
      </>
    );
  }
  if (!data) return <Spinner />;

  const scheduled = data.hearings.find((h) => h.status === 'SCHEDULED');
  const closed = data.status === 'CLOSED';

  return (
    <>
      <PageHeader title={`Manage case ${data.cin}`} subtitle={`${data.defendantName} · ${data.crimeType}`} />
      <SuccessMessage>{success}</SuccessMessage>
      
      {isEditing ? (
        <EditCaseForm data={data} onCancel={() => setIsEditing(false)} onDone={onDone} />
      ) : (
        <>
          <CaseSummary data={data} />
          {!closed && (
            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <button className="btn" onClick={() => setIsEditing(true)}>Edit case details</button>
            </div>
          )}
        </>
      )}
      
      <HearingHistory hearings={data.hearings} />
      {!closed && (
        <div className="grid-2" key={data.hearings.length + data.status}>
          {scheduled ? (
            <>
              <ProceedingsForm cin={data.cin} hearing={scheduled} onDone={onDone} />
              <AdjournForm cin={data.cin} hearing={scheduled} onDone={onDone} />
            </>
          ) : (
            <>
              <ScheduleForm cin={data.cin} onDone={onDone} />
              {data.status === 'PENDING' && <CloseForm cin={data.cin} onDone={onDone} />}
            </>
          )}
        </div>
      )}
    </>
  );
}

export function OpenCaseForm() {
  const [cin, setCin] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="card narrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (cin.trim()) navigate(`/registrar/cases/${encodeURIComponent(cin.trim().toUpperCase())}`);
      }}
    >
      <Field label="Case Identification Number (CIN)">
        <input value={cin} onChange={(e) => setCin(e.target.value)} placeholder="CIN-000001" />
      </Field>
      <button className="btn btn-primary">Open case</button>
    </form>
  );
}

export function OpenCasePage() {
  return (
    <>
      <PageHeader title="Manage a case" subtitle="Open a case by CIN to schedule, adjourn, record proceedings or close it." />
      <OpenCaseForm />
    </>
  );
}

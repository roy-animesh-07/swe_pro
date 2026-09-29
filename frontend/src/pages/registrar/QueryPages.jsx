import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { EmptyState, ErrorMessage, Field, PageHeader, Spinner, StatusBadge, formatDate } from '../../components/common.jsx';

const caseLink = (cin) => <Link to={`/registrar/cases/${encodeURIComponent(cin)}`} className="mono">{cin}</Link>;

/** (a) Pending cases sorted by CIN. */
export function PendingCasesPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.pendingCases().then(setRows).catch(setError);
  }, []);
  return (
    <>
      <PageHeader title="Pending cases" subtitle="All unresolved cases, sorted by CIN." />
      <ErrorMessage error={error} />
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <EmptyState>No pending cases.</EmptyState>}
      {rows && rows.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Start date</th>
                <th>CIN</th>
                <th>Defendant</th>
                <th>Address</th>
                <th>Crime details</th>
                <th>Lawyer</th>
                <th>Public prosecutor</th>
                <th>Judge</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cin}>
                  <td className="nowrap">{formatDate(r.startDate)}</td>
                  <td>{caseLink(r.cin)}</td>
                  <td>{r.defendantName}</td>
                  <td>{r.defendantAddress}</td>
                  <td>
                    <strong>{r.crimeType}</strong>
                    <div className="muted small">
                      {formatDate(r.committedDate)} · {r.committedLocation}
                    </div>
                  </td>
                  <td>{r.lawyerName}</td>
                  <td>{r.publicProsecutor}</td>
                  <td>{r.judgeName}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** (b) Cases resolved over a period, chronological by start date. */
export function ResolvedCasesPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!from || !to) return setError('Choose both dates.');
    if (from > to) return setError('"From" must not be after "To".');
    setBusy(true);
    setError(null);
    try {
      setRows(await api.resolvedCases(from, to));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <>
      <PageHeader title="Resolved cases" subtitle="Cases whose judgment was delivered in the chosen period, ordered by case start date." />
      <form className="card inline-form" onSubmit={submit} noValidate>
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </Field>
        <button className="btn btn-primary" disabled={busy}>Search</button>
      </form>
      <ErrorMessage error={error} />
      {rows && rows.length === 0 && <EmptyState>No cases were resolved in this period.</EmptyState>}
      {rows && rows.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Start date</th>
                <th>CIN</th>
                <th>Judgment date</th>
                <th>Judge</th>
                <th>Judgment summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cin}>
                  <td className="nowrap">{formatDate(r.startDate)}</td>
                  <td>{caseLink(r.cin)}</td>
                  <td className="nowrap">{formatDate(r.judgmentDate)}</td>
                  <td>{r.judgeName}</td>
                  <td className="wrap">{r.judgmentSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** (c) Cases coming up for hearing on a date. */
export function HearingsByDatePage() {
  const [date, setDate] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!date) return setError('Choose a date.');
    setError(null);
    try {
      setRows(await api.hearingsOn(date));
    } catch (err) {
      setError(err);
    }
    return undefined;
  }

  return (
    <>
      <PageHeader title="Hearings by date" subtitle="Cases coming up for hearing on a particular day." />
      <form className="card inline-form" onSubmit={submit} noValidate>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        </Field>
        <button className="btn btn-primary">Show hearings</button>
      </form>
      <ErrorMessage error={error} />
      {rows && rows.length === 0 && <EmptyState>No hearings on {formatDate(date)}.</EmptyState>}
      {rows && rows.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time slot</th>
                <th>CIN</th>
                <th>Hearing ID</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hearingId}>
                  <td>{r.timeSlot}</td>
                  <td>{caseLink(r.cin)}</td>
                  <td className="mono">{r.hearingId}</td>
                  <td>{formatDate(r.hearingDate)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** (d) Status of a particular case. */
export function CaseStatusPage() {
  const [cin, setCin] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!cin.trim()) return setError('Enter a CIN.');
    setError(null);
    setResult(null);
    try {
      setResult(await api.caseStatus(cin.trim().toUpperCase()));
    } catch (err) {
      setError(err);
    }
    return undefined;
  }

  return (
    <>
      <PageHeader title="Case status" subtitle="Look up the current status of a case by its CIN." />
      <form className="card inline-form" onSubmit={submit} noValidate>
        <Field label="CIN">
          <input value={cin} onChange={(e) => setCin(e.target.value)} placeholder="CIN-000001" aria-label="CIN" />
        </Field>
        <button className="btn btn-primary">Check status</button>
      </form>
      <ErrorMessage error={error} />
      {result && (
        <div className="card narrow status-result">
          <span className="mono">{result.cin}</span>
          <StatusBadge status={result.status} />
          {caseLink(result.cin)}
        </div>
      )}
    </>
  );
}

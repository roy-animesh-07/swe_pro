import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CaseSummary, HearingHistory } from '../../components/CaseDetails.jsx';
import { EmptyState, ErrorMessage, PageHeader, Spinner, formatDate } from '../../components/common.jsx';

const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL || '₹';
const basePath = (role) => (role === 'LAWYER' ? '/lawyer/past-cases' : '/judge/past-cases');

/** Keyword search of old (closed) cases, for judges and lawyers. */
export function PastCaseSearchPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') || '';
  const [input, setInput] = useState(keyword);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!keyword) return;
    setBusy(true);
    setError(null);
    api
      .searchPastCases(keyword)
      .then(setRows)
      .catch(setError)
      .finally(() => setBusy(false));
  }, [keyword]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim()) return setError('Enter one or more keywords.');
    setParams({ q: input.trim() });
    return undefined;
  }

  return (
    <>
      <PageHeader
        title="Search old cases"
        subtitle={
          user.role === 'LAWYER'
            ? 'Search closed cases by keyword. Opening a case’s full details is charged per view.'
            : 'Search closed cases by keyword for reference.'
        }
      />
      <form className="card inline-form" onSubmit={submit} noValidate>
        <label className="field grow">
          <span className="field-label">Keywords</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. burglary Pune, defendant name, judge, CIN"
            aria-label="Keywords"
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Search
        </button>
      </form>
      <ErrorMessage error={error} />
      {busy && <Spinner label="Searching…" />}
      {!busy && rows && rows.length === 0 && <EmptyState>No old cases match “{keyword}”.</EmptyState>}
      {!busy && rows && rows.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>CIN</th>
                <th>Defendant</th>
                <th>Crime type</th>
                <th>Start date</th>
                <th>Judgment date</th>
                <th>Judge</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cin}>
                  <td className="mono">{r.cin}</td>
                  <td>{r.defendantName}</td>
                  <td>{r.crimeType}</td>
                  <td className="nowrap">{formatDate(r.startDate)}</td>
                  <td className="nowrap">{formatDate(r.judgmentDate)}</td>
                  <td>{r.judgeName}</td>
                  <td className="right">
                    <Link className="btn btn-sm" to={`${basePath(user.role)}/${encodeURIComponent(r.cin)}`}>
                      {user.role === 'LAWYER' ? 'View (charged)' : 'View'}
                    </Link>
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

/**
 * Full old-case details. Judges load immediately (free). Lawyers must confirm first,
 * because every successful view is charged and recorded by the server.
 */
export function PastCaseViewPage() {
  const { cin } = useParams();
  const { user } = useAuth();
  const isLawyer = user.role === 'LAWYER';
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.viewPastCase(cin));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Guard against React StrictMode's double effect so a view is only requested once.
    if (!isLawyer && !started.current) {
      started.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cin, isLawyer]);

  const back = (
    <Link to={basePath(user.role)} className="btn btn-ghost">
      ← Back to search
    </Link>
  );

  if (!result) {
    return (
      <>
        <PageHeader title={`Old case ${cin}`}>{back}</PageHeader>
        <ErrorMessage error={error} />
        {isLawyer ? (
          <div className="card narrow">
            <p>
              Viewing the full details of an old case is <strong>charged per view</strong>. The charge is recorded
              against your account when the details are shown.
            </p>
            <button type="button" className="btn btn-primary" onClick={load} disabled={busy}>
              {busy ? 'Loading…' : error ? 'Try again' : 'Accept charge and view case'}
            </button>
          </div>
        ) : (
          busy && <Spinner />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Old case ${result.case.cin}`}>{back}</PageHeader>
      {result.charge !== null && result.charge !== undefined && (
        <div className="alert alert-info" role="status">
          A charge of {CURRENCY}
          {Number(result.charge).toFixed(2)} was recorded for this view
          {result.viewCount !== undefined && ` · old cases viewed on your account: ${result.viewCount}`}.
        </div>
      )}
      <CaseSummary data={result.case} />
      <HearingHistory hearings={result.case.hearings} />
    </>
  );
}

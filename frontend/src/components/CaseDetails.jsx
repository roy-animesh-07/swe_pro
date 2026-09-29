import { StatusBadge, formatDate, EmptyState } from './common.jsx';

function Item({ label, children }) {
  return (
    <div className="dl-item">
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export function CaseSummary({ data }) {
  return (
    <section className="card">
      <div className="card-title-row">
        <h2>
          {data.cin} <StatusBadge status={data.status} />
        </h2>
      </div>
      <dl className="dl-grid">
        <Item label="Defendant">{data.defendantName}</Item>
        <Item label="Defendant address">{data.defendantAddress}</Item>
        <Item label="Crime type">{data.crimeType}</Item>
        <Item label="Date committed">{formatDate(data.committedDate)}</Item>
        <Item label="Location committed">{data.committedLocation}</Item>
        <Item label="Arresting officer">{data.arrestingOfficer}</Item>
        <Item label="Arrest date">{formatDate(data.arrestDate)}</Item>
        <Item label="Presiding judge">{data.judgeName}</Item>
        <Item label="Public prosecutor">{data.publicProsecutor}</Item>
        <Item label="Lawyer">{data.lawyerName}</Item>
        <Item label="Case start date">{formatDate(data.startDate)}</Item>
        <Item label="Expected completion">{formatDate(data.expectedCompletionDate)}</Item>
      </dl>
      {data.status === 'CLOSED' && (
        <div className="judgment">
          <h3>Judgment · {formatDate(data.judgmentDate)}</h3>
          <p>{data.judgmentSummary}</p>
        </div>
      )}
    </section>
  );
}

export function HearingHistory({ hearings }) {
  return (
    <section className="card">
      <h2>Hearing history</h2>
      {!hearings?.length ? (
        <EmptyState>No hearings yet.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hearing ID</th>
                <th>Date</th>
                <th>Slot</th>
                <th>Status</th>
                <th>Proceedings / adjournment reason</th>
              </tr>
            </thead>
            <tbody>
              {hearings.map((h) => (
                <tr key={h.hearingId}>
                  <td className="mono">{h.hearingId}</td>
                  <td>{formatDate(h.hearingDate)}</td>
                  <td>{h.timeSlot}</td>
                  <td>
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="wrap">
                    {h.proceedingsSummary || (h.adjournmentReason ? `Adjourned: ${h.adjournmentReason}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

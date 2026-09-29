export function ErrorMessage({ error }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message || 'Something went wrong.';
  return (
    <div className="alert alert-error" role="alert">
      {msg}
    </div>
  );
}

export function SuccessMessage({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-success" role="status">
      {children}
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className={`field${error ? ' field-invalid' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

const STATUS_LABEL = {
  REGISTERED: 'Registered',
  HEARING_SCHEDULED: 'Hearing scheduled',
  PENDING: 'Pending',
  CLOSED: 'Closed',
  SCHEDULED: 'Scheduled',
  ADJOURNED: 'Adjourned',
  COMPLETED: 'Completed',
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status).toLowerCase()}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <p className="muted" aria-busy="true">
      {label}
    </p>
  );
}

export function EmptyState({ children }) {
  return <p className="empty">{children}</p>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

import { useEffect, useId, useState } from 'react';
import { api } from '../services/api.js';

/**
 * Pick a working day and one of its vacant slots.
 * The list is only a preview — the server re-checks the slot on submit.
 * Increment `refreshKey` to reload availability (e.g. after a 409 conflict).
 */
export default function SlotPicker({ value, onChange, refreshKey = 0, label = 'Hearing date', minDate }) {
  const id = useId();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const date = value?.date || '';

  useEffect(() => {
    let cancelled = false;
    setSlots([]);
    setError(null);
    if (!date) return undefined;
    setLoading(true);
    api
      .availability(date)
      .then((res) => {
        if (cancelled) return;
        setSlots(res.availableSlots);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  // Drop a selected slot that is no longer vacant.
  useEffect(() => {
    if (value?.slot && !loading && !slots.includes(value.slot)) onChange({ date, slot: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, loading]);

  return (
    <div className="slot-picker">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => onChange({ date: e.target.value, slot: '' })}
          aria-label={label}
        />
      </label>
      {date && (
        <div className="slots" role="radiogroup" aria-label="Vacant slots">
          {loading && <span className="muted">Checking vacant slots…</span>}
          {error && <span className="field-error">{error}</span>}
          {!loading && !error && slots.length === 0 && <span className="muted">No vacant slots on this day.</span>}
          {!loading &&
            !error &&
            slots.map((s) => (
              <label key={s} className={`slot${value?.slot === s ? ' slot-selected' : ''}`}>
                <input
                  type="radio"
                  name={`slot-${id}`}
                  value={s}
                  checked={value?.slot === s}
                  onChange={() => onChange({ date, slot: s })}
                />
                {s}
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

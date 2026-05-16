import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { CONSOLE_FAMILIES, fonts } from './theme.js';
import { styles, formatShortDate, formatRelativeDate } from './ui.js';

const ROLE_LABELS = {
  primary: 'Primary',
  backup: 'Backup',
  derived_from: 'Derived from',
};

export default function Events({ T, onOpenShowfile, refreshKey }) {
  const S = styles(T);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [venueFilter, setVenueFilter] = useState('');

  useEffect(() => {
    setLoading(true); setErr(null);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    api.listEvents(params)
      .then((d) => setEvents(d.events || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [from, to, refreshKey]);

  const filtered = useMemo(() => {
    if (!venueFilter.trim()) return events;
    const n = venueFilter.toLowerCase();
    return events.filter((e) => (e.venue || '').toLowerCase().includes(n) || (e.showfile_name || '').toLowerCase().includes(n));
  }, [events, venueFilter]);

  // group by month (YYYY-MM)
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = (e.event_date || '').slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <label style={S.label}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...S.input, width: '160px' }} />
        </div>
        <div>
          <label style={S.label}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...S.input, width: '160px' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={S.label}>Filter</label>
          <input placeholder="venue or showfile name" value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} style={S.input} />
        </div>
        {(from || to || venueFilter) && (
          <button onClick={() => { setFrom(''); setTo(''); setVenueFilter(''); }} style={{ ...S.btn, ...S.btnGhost, color: T.textDim }}>clear</button>
        )}
      </div>

      <div style={{ color: T.textDim, fontSize: '12px', fontFamily: fonts.mono, marginBottom: '14px' }}>
        {loading ? 'Loading…' : `${filtered.length} event${filtered.length === 1 ? '' : 's'}`}
        {err && <span style={{ color: T.red, marginLeft: '8px' }}> · {err}</span>}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: T.textDim,
          border: `1px dashed ${T.border}`,
          borderRadius: '12px',
        }}>
          No events match.
        </div>
      )}

      {grouped.map(([month, rows]) => (
        <div key={month} style={{ marginBottom: '24px' }}>
          <div style={{
            fontFamily: fonts.mono,
            fontSize: '11px',
            color: T.textFaint,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            padding: '6px 0 10px',
            borderBottom: `1px solid ${T.border}`,
            marginBottom: '8px',
          }}>{monthLabel(month)} · {rows.length} event{rows.length === 1 ? '' : 's'}</div>
          {rows.map((e) => <EventCard key={e.id} T={T} e={e} onOpen={() => onOpenShowfile(e.showfile_id)} />)}
        </div>
      ))}
    </div>
  );
}

function monthLabel(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d.getTime())) return ym;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function EventCard({ T, e, onOpen }) {
  const S = styles(T);
  const fam = CONSOLE_FAMILIES[e.showfile_console] || CONSOLE_FAMILIES.other;
  return (
    <div
      onClick={onOpen}
      style={{
        ...S.card,
        padding: '12px 14px',
        marginBottom: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      <div style={{ width: '70px', flexShrink: 0, fontFamily: fonts.mono, fontSize: '12px', color: T.textDim, lineHeight: 1.2 }}>
        <div style={{ color: T.text, fontWeight: 600, fontSize: '16px' }}>{(e.event_date || '').slice(8, 10)}</div>
        <div>{(e.event_date || '').slice(5, 7) ? new Date(e.event_date).toLocaleDateString(undefined, { month: 'short' }).toLowerCase() : ''}</div>
        <div style={{ fontSize: '10px', color: T.textFaint }}>{formatRelativeDate(e.event_date)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: T.text, marginBottom: '2px' }}>{e.event_name}</div>
        <div style={{ fontSize: '12px', color: T.textDim, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: fam.color }} />
            {e.showfile_name || '(unknown showfile)'}
          </span>
          {e.venue && <span>· {e.venue}</span>}
          <span style={{ ...S.pill, background: T.surfaceAlt, color: T.textDim, border: `1px solid ${T.border}` }}>
            {ROLE_LABELS[e.role] || e.role}
          </span>
        </div>
        {e.notes && <div style={{ fontSize: '12px', color: T.textBody, marginTop: '4px' }}>{e.notes}</div>}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { CONSOLE_FAMILIES, fonts } from './theme.js';
import { styles, formatShortDate } from './ui.js';

const ROLES = [
  { id: 'primary', label: 'Primary' },
  { id: 'backup', label: 'Backup' },
  { id: 'derived_from', label: 'Derived from' },
];

export default function AddEvent({ T, onSaved }) {
  const S = styles(T);
  const [showfiles, setShowfiles] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('');
  const [role, setRole] = useState('primary');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.listShowfiles({ archived: 'all' })
      .then((data) => setShowfiles(data.showfiles || []))
      .catch(() => setShowfiles([]))
      .finally(() => setLoadingList(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return showfiles.slice(0, 8);
    const n = query.toLowerCase();
    return showfiles.filter((s) =>
      (s.name || '').toLowerCase().includes(n)
      || (s.client || '').toLowerCase().includes(n)
      || (s.venue || '').toLowerCase().includes(n)
    ).slice(0, 12);
  }, [showfiles, query]);

  const selected = showfiles.find((s) => s.id === selectedId);

  // Prefill venue when showfile picked
  useEffect(() => {
    if (selected && !venue) setVenue(selected.venue || '');
    // eslint-disable-next-line
  }, [selectedId]);

  async function submit() {
    if (!selectedId) { setErr('Pick a showfile.'); return; }
    if (!eventName.trim() || !eventDate) { setErr('Name + date required.'); return; }
    setBusy(true); setErr(null);
    try {
      await api.createEvent({ showfile_id: selectedId, event_name: eventName, event_date: eventDate, venue, role, notes });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ ...S.card, padding: '24px', maxWidth: '780px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>New event</h2>
      <p style={{ fontSize: '12px', color: T.textDim, marginBottom: '20px' }}>Log a gig and link it to a showfile.</p>

      <div style={{ marginBottom: '14px' }}>
        <label style={S.label}>Showfile</label>
        {selected ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: '8px',
          }}>
            <div>
              <div style={{ color: T.text, fontWeight: 500 }}>{selected.name}</div>
              <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono }}>
                {(CONSOLE_FAMILIES[selected.console_family] || {}).label || selected.console_family}
                {selected.client ? ` · ${selected.client}` : ''}
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} style={{ ...S.btn, ...S.btnGhost, color: T.textDim, padding: '6px 10px', fontSize: '12px' }}>change</button>
          </div>
        ) : (
          <>
            <input
              autoFocus
              placeholder={loadingList ? 'Loading…' : 'Type to search showfiles…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={S.input}
            />
            {showfiles.length === 0 && !loadingList && (
              <div style={{ color: T.textFaint, fontSize: '12px', marginTop: '6px' }}>
                No showfiles yet. Create one first.
              </div>
            )}
            {filtered.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
                {filtered.map((s) => {
                  const fam = CONSOLE_FAMILIES[s.console_family] || CONSOLE_FAMILIES.other;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        borderRadius: '8px',
                        color: T.text,
                        cursor: 'pointer',
                        fontFamily: fonts.body,
                        display: 'flex', alignItems: 'center', gap: '10px',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: fam.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono }}>
                          {fam.label}{s.client ? ` · ${s.client}` : ''}{s.last_used_at ? ` · last ${formatShortDate(s.last_used_at)}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '14px' }}>
        <div>
          <label style={S.label}>Event name</label>
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder='e.g. "Easter Sunday — 10am service"' style={S.input} />
        </div>
        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={S.input} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '14px', marginTop: '14px' }}>
        <div>
          <label style={S.label}>Venue</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="optional, prefilled from showfile" style={S.input} />
        </div>
        <div>
          <label style={S.label}>Role</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: role === r.id ? T.accent : T.surface,
                  color: role === r.id ? T.accentText : T.text,
                  border: `1px solid ${role === r.id ? T.accent : T.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: fonts.body,
                }}
              >{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <label style={S.label}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything specific about this run — set changes, weather, weird requests…"
          style={{ ...S.input, resize: 'vertical' }}
        />
      </div>

      {err && <div style={{ color: T.red, fontSize: '13px', marginTop: '10px' }}>{err}</div>}

      <div style={{ marginTop: '16px' }}>
        <button onClick={submit} disabled={busy} style={{ ...S.btn, ...S.btnPrimary }}>
          {busy ? 'Saving…' : 'Save event'}
        </button>
      </div>
    </div>
  );
}

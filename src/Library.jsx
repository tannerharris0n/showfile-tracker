import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { CONSOLE_FAMILIES, CONSOLE_KEYS, fonts } from './theme.js';
import { styles, formatRelativeDate, formatShortDate } from './ui.js';

const SORTS = [
  { id: 'last_used', label: 'Last used' },
  { id: 'name', label: 'Name' },
  { id: 'created', label: 'Created' },
  { id: 'client', label: 'Client' },
];

export default function Library({ T, onOpen, refreshKey }) {
  const S = styles(T);
  const [showfiles, setShowfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('last_used');

  useEffect(() => {
    setLoading(true);
    setErr(null);
    const params = {};
    if (consoleFilter !== 'all') params.console = consoleFilter;
    if (showArchived) params.archived = 'all';
    api.listShowfiles(params)
      .then((data) => setShowfiles(data.showfiles || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [consoleFilter, showArchived, refreshKey]);

  const filtered = useMemo(() => {
    let list = showfiles;
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((s) => {
        const hay = [s.name, s.client, s.venue, s.notes, s.tags, s.rig_summary, s.console_version]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.indexOf(needle) !== -1;
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'client') return (a.client || '').localeCompare(b.client || '') || (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') return (b.created_at || '').localeCompare(a.created_at || '');
      // last_used: nulls last, then newest first
      if (!a.last_used_at && !b.last_used_at) return 0;
      if (!a.last_used_at) return 1;
      if (!b.last_used_at) return -1;
      return b.last_used_at.localeCompare(a.last_used_at);
    });
    return sorted;
  }, [showfiles, q, sortBy]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search name, venue, client, notes, tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ ...S.input, maxWidth: '380px' }}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...S.input, width: 'auto', cursor: 'pointer' }}>
          {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: T.textDim, fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          show archived
        </label>
      </div>

      {/* Console family chips */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <ConsoleChip T={T} active={consoleFilter === 'all'} onClick={() => setConsoleFilter('all')} label="All" />
        {CONSOLE_KEYS.map((k) => (
          <ConsoleChip
            key={k}
            T={T}
            active={consoleFilter === k}
            onClick={() => setConsoleFilter(k)}
            label={CONSOLE_FAMILIES[k].label}
            color={CONSOLE_FAMILIES[k].color}
          />
        ))}
      </div>

      {/* Status line */}
      <div style={{ color: T.textDim, fontSize: '12px', fontFamily: fonts.mono, marginBottom: '14px' }}>
        {loading ? 'Loading…' : `${filtered.length} showfile${filtered.length === 1 ? '' : 's'}`}
        {err && <span style={{ color: T.red, marginLeft: '8px' }}> · {err}</span>}
      </div>

      {/* Grid */}
      {!loading && filtered.length === 0 && (
        <EmptyState T={T} hasFilters={!!q || consoleFilter !== 'all' || showArchived} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
        {filtered.map((s) => (
          <ShowfileCard key={s.id} T={T} sf={s} onOpen={() => onOpen(s.id)} />
        ))}
      </div>
    </div>
  );
}

function ConsoleChip({ T, active, onClick, label, color }) {
  const dotColor = color || T.textFaint;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px',
      background: active ? T.surface : 'transparent',
      color: active ? T.text : T.textDim,
      border: `1px solid ${active ? T.borderHover : T.border}`,
      borderRadius: '999px',
      fontSize: '12px',
      fontFamily: fonts.body,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}>
      {color && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />}
      {label}
    </button>
  );
}

function ShowfileCard({ T, sf, onOpen }) {
  const S = styles(T);
  const family = CONSOLE_FAMILIES[sf.console_family] || CONSOLE_FAMILIES.other;
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.card,
        padding: '16px',
        cursor: 'pointer',
        borderColor: hover ? family.color : T.border,
        transform: hover ? 'translateY(-1px)' : 'none',
        opacity: sf.archived ? 0.6 : 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Top: console badge + archived flag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          ...S.pill,
          background: `${family.color}22`,
          color: family.color,
          border: `1px solid ${family.color}55`,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: family.color }} />
          {family.label}
          {sf.console_version && <span style={{ color: T.textDim, marginLeft: '4px' }}>{sf.console_version}</span>}
        </span>
        {sf.archived ? (
          <span style={{ ...S.pill, background: T.surfaceAlt, color: T.textFaint, border: `1px solid ${T.border}` }}>archived</span>
        ) : null}
      </div>

      {/* Name */}
      <h3 style={{
        fontSize: '15px',
        fontWeight: 600,
        color: T.text,
        margin: 0,
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>{sf.name}</h3>

      {/* Client / venue */}
      <div style={{ fontSize: '12px', color: T.textBody, lineHeight: 1.5 }}>
        {sf.client && <div><span style={{ color: T.textFaint }}>client </span>{sf.client}</div>}
        {sf.venue && <div><span style={{ color: T.textFaint }}>venue </span>{sf.venue}</div>}
      </div>

      {/* Tags */}
      {sf.tags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {sf.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5).map((tag) => (
            <span key={tag} style={{ ...S.pill, background: T.surfaceAlt, color: T.textDim, border: `1px solid ${T.border}` }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '8px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '11px',
        color: T.textDim,
        fontFamily: fonts.mono,
      }}>
        <span title={sf.last_used_at ? formatShortDate(sf.last_used_at) : 'never used'}>
          {sf.event_count} event{sf.event_count === 1 ? '' : 's'} · {sf.last_used_at ? formatRelativeDate(sf.last_used_at) : 'no events'}
        </span>
        {sf.external_url && (
          <a
            href={sf.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open external file"
            style={{
              padding: '4px 8px',
              background: T.surfaceAlt,
              color: T.accent,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid ${T.border}`,
            }}
          >↗ open</a>
        )}
      </div>
    </div>
  );
}

function EmptyState({ T, hasFilters }) {
  return (
    <div style={{
      padding: '48px 24px',
      textAlign: 'center',
      color: T.textDim,
      border: `1px dashed ${T.border}`,
      borderRadius: '12px',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.4 }}>○</div>
      <div style={{ fontSize: '14px', marginBottom: '4px', color: T.text }}>
        {hasFilters ? 'No showfiles match.' : 'No showfiles yet.'}
      </div>
      <div style={{ fontSize: '12px' }}>
        {hasFilters ? 'Try clearing filters.' : 'Hit "+ Add" to log your first one.'}
      </div>
    </div>
  );
}

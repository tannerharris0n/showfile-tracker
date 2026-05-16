import { useEffect, useState } from 'react';
import { marked } from 'marked';
import { api } from './api.js';
import { CONSOLE_FAMILIES, CONSOLE_KEYS, fonts } from './theme.js';
import { styles, formatShortDate, formatRelativeDate } from './ui.js';

marked.setOptions({ breaks: true, gfm: true });

const ROLES = [
  { id: 'primary', label: 'Primary' },
  { id: 'backup', label: 'Backup' },
  { id: 'derived_from', label: 'Derived from' },
];

export default function ShowfileDetail({ T, id, onBack, onChange }) {
  const S = styles(T);
  const [sf, setSf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null); // field name being edited
  const [draft, setDraft] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addingVersion, setAddingVersion] = useState(false);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getShowfile(id)
      .then((data) => { setSf(data.showfile); setDraft(data.showfile); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function reload() {
    return api.getShowfile(id).then((data) => { setSf(data.showfile); setDraft(data.showfile); onChange && onChange(); });
  }

  async function saveField(field) {
    if ((draft[field] ?? null) === (sf[field] ?? null)) {
      setEditing(null);
      return;
    }
    try {
      await api.updateShowfile(id, { [field]: draft[field] });
      await reload();
      setEditing(null);
    } catch (e) { alert(e.message); }
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopyState(label);
      setTimeout(() => setCopyState(''), 1500);
    } catch {}
  }

  async function doArchive() {
    if (sf.archived) await api.restoreShowfile(id);
    else await api.archiveShowfile(id);
    await reload();
  }

  async function doDelete() {
    try {
      await api.deleteShowfile(id);
      onChange && onChange();
      onBack();
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div style={{ color: T.textDim }}>Loading…</div>;
  if (err) return <div style={{ color: T.red }}>Error: {err}</div>;
  if (!sf) return <div style={{ color: T.textDim }}>Not found.</div>;

  const family = CONSOLE_FAMILIES[sf.console_family] || CONSOLE_FAMILIES.other;

  return (
    <div>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', color: T.textDim,
        cursor: 'pointer', fontSize: '13px', padding: '4px 0', marginBottom: '16px', fontFamily: fonts.body,
      }}>← back to library</button>

      {/* Header */}
      <div style={{ ...S.card, marginBottom: '20px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...S.pill, background: `${family.color}22`, color: family.color, border: `1px solid ${family.color}55` }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: family.color }} />
                {family.label}
              </span>
              {sf.archived && <span style={{ ...S.pill, background: T.surfaceAlt, color: T.textFaint, border: `1px solid ${T.border}` }}>archived</span>}
              <span style={{ fontSize: '11px', color: T.textFaint, fontFamily: fonts.mono }}>
                created {formatShortDate(sf.created_at)} · updated {formatRelativeDate(sf.updated_at)}
              </span>
            </div>
            <InlineText
              T={T} value={draft.name} editing={editing === 'name'}
              onEdit={() => setEditing('name')}
              onChange={(v) => setDraft({ ...draft, name: v })}
              onSave={() => saveField('name')}
              onCancel={() => { setDraft(sf); setEditing(null); }}
              style={{ fontSize: '22px', fontWeight: 700, color: T.text, lineHeight: 1.2 }}
              placeholder="Untitled showfile"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sf.external_url && (
              <a href={sf.external_url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, ...S.btnPrimary, textDecoration: 'none' }}>
                ↗ Open file
              </a>
            )}
            {sf.external_url && (
              <button onClick={() => copy(sf.external_url, 'url')} style={{ ...S.btn, ...S.btnSecondary }}>
                {copyState === 'url' ? '✓ copied' : 'Copy URL'}
              </button>
            )}
            {sf.storage_location_label && (
              <button onClick={() => copy(sf.storage_location_label, 'path')} style={{ ...S.btn, ...S.btnSecondary }}>
                {copyState === 'path' ? '✓ copied' : 'Copy path'}
              </button>
            )}
          </div>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '10px' }}>
          <FieldDropdown
            T={T} label="Console" value={draft.console_family} options={CONSOLE_KEYS.map((k) => ({ id: k, label: CONSOLE_FAMILIES[k].label }))}
            editing={editing === 'console_family'} onEdit={() => setEditing('console_family')}
            onChange={(v) => { setDraft({ ...draft, console_family: v }); }}
            onSave={() => saveField('console_family')}
            onCancel={() => { setDraft(sf); setEditing(null); }}
          />
          <Field T={T} label="Console version" value={draft.console_version}
            editing={editing === 'console_version'} onEdit={() => setEditing('console_version')}
            onChange={(v) => setDraft({ ...draft, console_version: v })}
            onSave={() => saveField('console_version')} onCancel={() => { setDraft(sf); setEditing(null); }}
            placeholder="e.g., Eos 3.2.4" />
          <Field T={T} label="File format" value={draft.file_format}
            editing={editing === 'file_format'} onEdit={() => setEditing('file_format')}
            onChange={(v) => setDraft({ ...draft, file_format: v })}
            onSave={() => saveField('file_format')} onCancel={() => { setDraft(sf); setEditing(null); }}
            placeholder={family.formats.join(', ') || '—'} />
          <Field T={T} label="External URL" value={draft.external_url}
            editing={editing === 'external_url'} onEdit={() => setEditing('external_url')}
            onChange={(v) => setDraft({ ...draft, external_url: v })}
            onSave={() => saveField('external_url')} onCancel={() => { setDraft(sf); setEditing(null); }}
            placeholder="https://dropbox.com/…" mono />
          <Field T={T} label="Storage label" value={draft.storage_location_label}
            editing={editing === 'storage_location_label'} onEdit={() => setEditing('storage_location_label')}
            onChange={(v) => setDraft({ ...draft, storage_location_label: v })}
            onSave={() => saveField('storage_location_label')} onCancel={() => { setDraft(sf); setEditing(null); }}
            placeholder="Dropbox / NW Lighting / 2026 / Easter" />
          <Field T={T} label="Client" value={draft.client}
            editing={editing === 'client'} onEdit={() => setEditing('client')}
            onChange={(v) => setDraft({ ...draft, client: v })}
            onSave={() => saveField('client')} onCancel={() => { setDraft(sf); setEditing(null); }} />
          <Field T={T} label="Venue" value={draft.venue}
            editing={editing === 'venue'} onEdit={() => setEditing('venue')}
            onChange={(v) => setDraft({ ...draft, venue: v })}
            onSave={() => saveField('venue')} onCancel={() => { setDraft(sf); setEditing(null); }} />
          <Field T={T} label="Tags" value={draft.tags}
            editing={editing === 'tags'} onEdit={() => setEditing('tags')}
            onChange={(v) => setDraft({ ...draft, tags: v })}
            onSave={() => saveField('tags')} onCancel={() => { setDraft(sf); setEditing(null); }}
            placeholder="comma,separated,tags" mono />
        </div>
      </div>

      {/* Rig summary + notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <TextareaCard T={T} title="Rig summary" value={draft.rig_summary} editing={editing === 'rig_summary'}
          onEdit={() => setEditing('rig_summary')}
          onChange={(v) => setDraft({ ...draft, rig_summary: v })}
          onSave={() => saveField('rig_summary')} onCancel={() => { setDraft(sf); setEditing(null); }}
          placeholder="Describe the rig — fixtures, positions, power, dimming, network…" />
        <TextareaCard T={T} title="Notes" value={draft.notes} editing={editing === 'notes'} markdown
          onEdit={() => setEditing('notes')}
          onChange={(v) => setDraft({ ...draft, notes: v })}
          onSave={() => saveField('notes')} onCancel={() => { setDraft(sf); setEditing(null); }}
          placeholder="Notes (markdown ok)…" />
      </div>

      {/* Events */}
      <div style={{ ...S.card, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: T.text, fontFamily: fonts.mono, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Events ({sf.events.length})
          </h3>
          <button onClick={() => setAddingEvent((v) => !v)} style={{ ...S.btn, ...S.btnGhost, color: T.accent }}>
            {addingEvent ? '× cancel' : '+ add event'}
          </button>
        </div>
        {addingEvent && (
          <AddEventInline T={T} showfileId={sf.id} prefillVenue={sf.venue}
            onDone={async () => { setAddingEvent(false); await reload(); }} />
        )}
        {sf.events.length === 0 && !addingEvent && (
          <div style={{ color: T.textFaint, fontSize: '13px', padding: '12px 0' }}>No events linked yet.</div>
        )}
        {sf.events.map((e) => (
          <EventRow key={e.id} T={T} ev={e} onDeleted={reload} />
        ))}
      </div>

      {/* Versions */}
      <div style={{ ...S.card, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: T.text, fontFamily: fonts.mono, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Versions ({sf.versions.length})
          </h3>
          <button onClick={() => setAddingVersion((v) => !v)} style={{ ...S.btn, ...S.btnGhost, color: T.accent }}>
            {addingVersion ? '× cancel' : '+ add version'}
          </button>
        </div>
        {addingVersion && (
          <AddVersionInline T={T} showfileId={sf.id}
            onDone={async () => { setAddingVersion(false); await reload(); }} />
        )}
        {sf.versions.length === 0 && !addingVersion && (
          <div style={{ color: T.textFaint, fontSize: '13px', padding: '12px 0' }}>No versions yet.</div>
        )}
        {sf.versions.map((v) => (
          <VersionRow key={v.id} T={T} v={v} onDeleted={reload} />
        ))}
      </div>

      {/* Danger zone */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={doArchive} style={{ ...S.btn, ...S.btnSecondary }}>
          {sf.archived ? 'Restore' : 'Archive'}
        </button>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} style={{ ...S.btn, ...S.btnDanger }}>Delete…</button>
        ) : (
          <>
            <button onClick={doDelete} style={{ ...S.btn, ...S.btnDanger, fontWeight: 600 }}>Confirm permanent delete</button>
            <button onClick={() => setConfirmingDelete(false)} style={{ ...S.btn, ...S.btnGhost }}>cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function InlineText({ T, value, editing, onEdit, onChange, onSave, onCancel, style, placeholder }) {
  if (editing) {
    return (
      <input
        autoFocus
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        style={{ ...style, width: '100%', background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: '6px', padding: '4px 6px', outline: 'none', fontFamily: 'inherit' }}
      />
    );
  }
  return (
    <div onClick={onEdit} style={{ ...style, cursor: 'text' }}>
      {value || <span style={{ color: T.textFaint, fontWeight: 400 }}>{placeholder}</span>}
    </div>
  );
}

function Field({ T, label, value, editing, onEdit, onChange, onSave, onCancel, placeholder, mono }) {
  const S = styles(T);
  return (
    <div>
      <label style={S.label}>{label}</label>
      {editing ? (
        <input
          autoFocus
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder={placeholder || ''}
          style={{ ...S.input, fontFamily: mono ? fonts.mono : fonts.body }}
        />
      ) : (
        <div onClick={onEdit} style={{
          fontSize: '14px',
          color: value ? T.text : T.textFaint,
          padding: '10px 12px',
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: '8px',
          cursor: 'text',
          minHeight: '40px',
          fontFamily: mono ? fonts.mono : fonts.body,
          wordBreak: 'break-word',
        }}>
          {value || (placeholder ? <span style={{ color: T.textFaint }}>{placeholder}</span> : '—')}
        </div>
      )}
    </div>
  );
}

function FieldDropdown({ T, label, value, options, editing, onEdit, onChange, onSave, onCancel }) {
  const S = styles(T);
  if (editing) {
    return (
      <div>
        <label style={S.label}>{label}</label>
        <select
          autoFocus
          value={value || 'other'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          style={S.input}
        >
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  const cur = options.find((o) => o.id === value);
  return (
    <div>
      <label style={S.label}>{label}</label>
      <div onClick={onEdit} style={{
        fontSize: '14px', color: T.text, padding: '10px 12px',
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: '8px',
        cursor: 'pointer', minHeight: '40px',
      }}>{cur ? cur.label : '—'}</div>
    </div>
  );
}

function TextareaCard({ T, title, value, editing, onEdit, onChange, onSave, onCancel, placeholder, markdown }) {
  const S = styles(T);
  const html = markdown && value ? marked.parse(value) : '';
  return (
    <div style={{ ...S.card }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: T.text, fontFamily: fonts.mono, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</h3>
        {editing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={onSave} style={{ ...S.btn, ...S.btnPrimary, padding: '5px 10px', fontSize: '12px' }}>save</button>
            <button onClick={onCancel} style={{ ...S.btn, ...S.btnGhost, padding: '5px 10px', fontSize: '12px' }}>cancel</button>
          </div>
        ) : (
          <button onClick={onEdit} style={{ ...S.btn, ...S.btnGhost, color: T.accent, padding: '5px 10px', fontSize: '12px' }}>edit</button>
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={8}
          style={{ ...S.input, fontFamily: fonts.mono, fontSize: '13px', minHeight: '160px', resize: 'vertical' }}
        />
      ) : value ? (
        markdown ? (
          <div className="markdown" style={{ fontSize: '13px', color: T.textBody, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre style={{ fontFamily: fonts.mono, fontSize: '13px', color: T.textBody, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>{value}</pre>
        )
      ) : (
        <div style={{ color: T.textFaint, fontSize: '13px' }}>{placeholder}</div>
      )}
    </div>
  );
}

function EventRow({ T, ev, onDeleted }) {
  const S = styles(T);
  const [confirming, setConfirming] = useState(false);
  const roleLabel = (ROLES.find((r) => r.id === ev.role) || ROLES[0]).label;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderTop: `1px solid ${T.border}`, gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: T.text, fontWeight: 500 }}>{ev.event_name}</div>
        <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono, marginTop: '2px' }}>
          {formatShortDate(ev.event_date)} · {roleLabel}{ev.venue ? ` · ${ev.venue}` : ''}
        </div>
        {ev.notes && <div style={{ fontSize: '12px', color: T.textBody, marginTop: '4px' }}>{ev.notes}</div>}
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={async () => { await api.deleteEvent(ev.id); onDeleted(); }} style={{ ...S.btn, ...S.btnDanger, padding: '4px 8px', fontSize: '11px' }}>confirm</button>
          <button onClick={() => setConfirming(false)} style={{ ...S.btn, ...S.btnGhost, padding: '4px 8px', fontSize: '11px' }}>×</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} style={{ ...S.btn, ...S.btnGhost, color: T.textFaint, padding: '4px 8px', fontSize: '11px' }}>delete</button>
      )}
    </div>
  );
}

function VersionRow({ T, v, onDeleted }) {
  const S = styles(T);
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderTop: `1px solid ${T.border}`, gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: T.text, fontWeight: 500 }}>{v.version_label}</div>
        <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono, marginTop: '2px' }}>
          {formatShortDate(v.created_at)}
          {v.external_url && <> · <a href={v.external_url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>↗ open</a></>}
        </div>
        {v.notes && <div style={{ fontSize: '12px', color: T.textBody, marginTop: '4px' }}>{v.notes}</div>}
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={async () => { await api.deleteVersion(v.id); onDeleted(); }} style={{ ...S.btn, ...S.btnDanger, padding: '4px 8px', fontSize: '11px' }}>confirm</button>
          <button onClick={() => setConfirming(false)} style={{ ...S.btn, ...S.btnGhost, padding: '4px 8px', fontSize: '11px' }}>×</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} style={{ ...S.btn, ...S.btnGhost, color: T.textFaint, padding: '4px 8px', fontSize: '11px' }}>delete</button>
      )}
    </div>
  );
}

function AddEventInline({ T, showfileId, prefillVenue, onDone }) {
  const S = styles(T);
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState(prefillVenue || '');
  const [role, setRole] = useState('primary');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name || !date) { alert('Event name + date required.'); return; }
    setBusy(true);
    try {
      await api.createEvent({ showfile_id: showfileId, event_name: name, event_date: date, venue, role, notes });
      onDone();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: T.bg, border: `1px dashed ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', marginBottom: '8px' }}>
        <input placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} style={S.input} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '8px', marginBottom: '8px' }}>
        <input placeholder="Venue (optional)" value={venue} onChange={(e) => setVenue(e.target.value)} style={S.input} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={S.input}>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...S.input, marginBottom: '8px', resize: 'vertical' }} />
      <button onClick={submit} disabled={busy} style={{ ...S.btn, ...S.btnPrimary }}>
        {busy ? 'Saving…' : 'Save event'}
      </button>
    </div>
  );
}

function AddVersionInline({ T, showfileId, onDone }) {
  const S = styles(T);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!label) { alert('Version label required.'); return; }
    setBusy(true);
    try {
      await api.createVersion(showfileId, { version_label: label, external_url: url, notes });
      onDone();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: T.bg, border: `1px dashed ${T.border}`, borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
      <input placeholder='Label, e.g. "v1.0 — opening night"' value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...S.input, marginBottom: '8px' }} />
      <input placeholder="External URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...S.input, marginBottom: '8px', fontFamily: fonts.mono }} />
      <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...S.input, marginBottom: '8px', resize: 'vertical' }} />
      <button onClick={submit} disabled={busy} style={{ ...S.btn, ...S.btnPrimary }}>
        {busy ? 'Saving…' : 'Save version'}
      </button>
    </div>
  );
}

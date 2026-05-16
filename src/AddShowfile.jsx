import { useState, useMemo } from 'react';
import { api } from './api.js';
import { CONSOLE_FAMILIES, CONSOLE_KEYS, fonts } from './theme.js';
import { styles } from './ui.js';

const STORAGE_HOSTS = {
  'dropbox.com':  'Dropbox',
  'icloud.com':   'iCloud Drive',
  'drive.google.com': 'Google Drive',
  'onedrive.live.com': 'OneDrive',
  '1drv.ms':      'OneDrive',
  'sharepoint.com': 'SharePoint',
  'box.com':      'Box',
  'mega.nz':      'MEGA',
  'pcloud.com':   'pCloud',
};

function detectStorage(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    for (const key of Object.keys(STORAGE_HOSTS)) {
      if (host === key || host.endsWith('.' + key)) return STORAGE_HOSTS[key];
    }
    return null;
  } catch { return null; }
}

export default function AddShowfile({ T, onSaved }) {
  const S = styles(T);
  const [form, setForm] = useState({
    name: '',
    console_family: 'eos',
    console_version: '',
    file_format: '',
    external_url: '',
    storage_location_label: '',
    client: '',
    venue: '',
    rig_summary: '',
    notes: '',
    tags: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const storageHint = useMemo(() => detectStorage(form.external_url), [form.external_url]);
  const suggestedFormats = CONSOLE_FAMILIES[form.console_family]?.formats || [];

  function update(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function save(thenAddEvent) {
    if (!form.name.trim()) { setErr('Name required.'); return; }
    setBusy(true);
    setErr(null);
    try {
      const { showfile } = await api.createShowfile(form);
      onSaved(thenAddEvent ? null : showfile.id);
      // (parent decides where to route)
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ ...S.card, padding: '24px', maxWidth: '780px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>New showfile</h2>
      <p style={{ fontSize: '12px', color: T.textDim, marginBottom: '20px' }}>
        Track the metadata. Keep the actual file wherever you already keep it (Dropbox, iCloud, USB…) — paste the link below.
      </p>

      <Section T={T} label="Name">
        <input
          autoFocus
          placeholder='e.g. "St. Andrews 2026 Easter"'
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          style={S.input}
        />
      </Section>

      <Section T={T} label="Console">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CONSOLE_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => update('console_family', k)}
              style={{
                ...S.pill,
                padding: '6px 12px',
                background: form.console_family === k ? `${CONSOLE_FAMILIES[k].color}22` : T.surfaceAlt,
                color: form.console_family === k ? CONSOLE_FAMILIES[k].color : T.textDim,
                border: `1px solid ${form.console_family === k ? CONSOLE_FAMILIES[k].color + '55' : T.border}`,
                cursor: 'pointer',
                fontFamily: fonts.body,
                fontSize: '12px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CONSOLE_FAMILIES[k].color }} />
              {CONSOLE_FAMILIES[k].label}
            </button>
          ))}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Section T={T} label="Console version" hint="e.g. Eos 3.2.4">
          <input value={form.console_version} onChange={(e) => update('console_version', e.target.value)} style={S.input} />
        </Section>
        <Section T={T} label="File format" hint={suggestedFormats.length ? `suggested: ${suggestedFormats.join(', ')}` : null}>
          <input
            value={form.file_format}
            onChange={(e) => update('file_format', e.target.value)}
            placeholder={suggestedFormats[0] || '.show'}
            style={{ ...S.input, fontFamily: fonts.mono }}
          />
        </Section>
      </div>

      <Section T={T} label="External URL" hint={storageHint ? `detected: ${storageHint}` : null}>
        <input
          type="url"
          placeholder="https://www.dropbox.com/scl/…"
          value={form.external_url}
          onChange={(e) => {
            const v = e.target.value;
            update('external_url', v);
            if (!form.storage_location_label && detectStorage(v)) {
              update('storage_location_label', detectStorage(v) + ' / ');
            }
          }}
          style={{ ...S.input, fontFamily: fonts.mono }}
        />
      </Section>

      <Section T={T} label="Storage location label" hint="Where you'd describe the file's location to your future self">
        <input
          placeholder="Dropbox / NW Lighting / 2026 / Easter"
          value={form.storage_location_label}
          onChange={(e) => update('storage_location_label', e.target.value)}
          style={S.input}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Section T={T} label="Client">
          <input value={form.client} onChange={(e) => update('client', e.target.value)} placeholder="e.g. St. Andrews Lutheran" style={S.input} />
        </Section>
        <Section T={T} label="Venue">
          <input value={form.venue} onChange={(e) => update('venue', e.target.value)} placeholder="e.g. St. Andrews Lutheran, Tukwila" style={S.input} />
        </Section>
      </div>

      <Section T={T} label="Rig summary">
        <textarea
          placeholder="Fixtures, positions, power, dimming, network…"
          value={form.rig_summary}
          onChange={(e) => update('rig_summary', e.target.value)}
          rows={4}
          style={{ ...S.input, fontFamily: fonts.mono, fontSize: '13px', resize: 'vertical' }}
        />
      </Section>

      <Section T={T} label="Notes" hint="Markdown ok">
        <textarea
          placeholder="Anything future-you would want to know."
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={4}
          style={{ ...S.input, fontFamily: fonts.body, resize: 'vertical' }}
        />
      </Section>

      <Section T={T} label="Tags" hint="Comma-separated">
        <input
          placeholder="worship,easter,recurring"
          value={form.tags}
          onChange={(e) => update('tags', e.target.value)}
          style={{ ...S.input, fontFamily: fonts.mono }}
        />
      </Section>

      {err && <div style={{ color: T.red, fontSize: '13px', marginBottom: '10px' }}>{err}</div>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button onClick={() => save(false)} disabled={busy} style={{ ...S.btn, ...S.btnPrimary }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => save(true)} disabled={busy} style={{ ...S.btn, ...S.btnSecondary }}>
          Save & add event
        </button>
      </div>
    </div>
  );
}

function Section({ T, label, hint, children }) {
  const S = styles(T);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={S.label}>{label}</label>
        {hint && <span style={{ fontSize: '11px', color: T.textFaint, fontFamily: fonts.mono }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { api, isOpenMode } from './api.js';
import { CONSOLE_FAMILIES, fonts } from './theme.js';
import { styles, formatShortDate } from './ui.js';

export default function Settings({ T, onChange }) {
  const S = styles(T);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importCsv, setImportCsv] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadStats();
  }, []);

  function loadStats() {
    setLoading(true); setErr(null);
    api.stats()
      .then((d) => setStats(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportCsv(String(reader.result || ''));
      setImportPreview(null);
      setImportMsg('');
    };
    reader.readAsText(f);
  }

  async function previewImport() {
    if (!importCsv) { setImportMsg('Pick a CSV file first.'); return; }
    setImportBusy(true); setImportMsg('');
    try {
      const res = await api.importCsv(importCsv, true);
      setImportPreview(res);
    } catch (e) { setImportMsg(e.message); }
    finally { setImportBusy(false); }
  }

  async function commitImport() {
    if (!importCsv) return;
    if (!confirm('Import this CSV? New rows will be inserted (existing data is preserved).')) return;
    setImportBusy(true); setImportMsg('');
    try {
      const res = await api.importCsv(importCsv, false);
      setImportMsg(`Imported ${res.showfiles} showfiles, ${res.events} events, ${res.versions} versions.`);
      setImportPreview(null);
      setImportCsv('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onChange && onChange();
      loadStats();
    } catch (e) { setImportMsg(e.message); }
    finally { setImportBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stats */}
      <div style={{ ...S.card }}>
        <h3 style={cardTitle(T)}>Library stats</h3>
        {loading ? (
          <div style={{ color: T.textDim }}>Loading…</div>
        ) : err ? (
          <div style={{ color: T.red }}>{err}</div>
        ) : stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <StatTile T={T} label="Active showfiles" value={stats.showfiles_active} />
              <StatTile T={T} label="Archived" value={stats.showfiles_archived} />
              <StatTile T={T} label="Events" value={stats.events} />
              <StatTile T={T} label="Versions" value={stats.versions} />
            </div>
            {stats.oldest_event_date && stats.newest_event_date && (
              <div style={{ fontSize: '12px', color: T.textDim, fontFamily: fonts.mono, marginBottom: '12px' }}>
                Event range: {formatShortDate(stats.oldest_event_date)} → {formatShortDate(stats.newest_event_date)}
              </div>
            )}
            {stats.by_console && stats.by_console.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>By console</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {stats.by_console.map((c) => {
                    const fam = CONSOLE_FAMILIES[c.console_family] || CONSOLE_FAMILIES.other;
                    return (
                      <span key={c.console_family} style={{
                        ...S.pill,
                        background: `${fam.color}22`,
                        color: fam.color,
                        border: `1px solid ${fam.color}55`,
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: fam.color }} />
                        {fam.label} <span style={{ color: T.textDim }}>{c.n}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backup */}
      <div style={{ ...S.card }}>
        <h3 style={cardTitle(T)}>Backup &amp; restore</h3>
        <p style={{ fontSize: '12px', color: T.textDim, marginBottom: '12px' }}>
          One CSV file contains all showfiles, events, and versions. Use it for migration, sharing a snapshot, or as a paranoid backup alongside the DB file.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <a href={api.exportCsvUrl} style={{ ...S.btn, ...S.btnPrimary, textDecoration: 'none' }}>
            ↓ Export CSV
          </a>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', color: T.textDim, marginBottom: '8px', fontFamily: fonts.mono, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Import CSV</div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFile}
            style={{ fontSize: '13px', color: T.textBody, marginBottom: '10px' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button onClick={previewImport} disabled={importBusy || !importCsv} style={{ ...S.btn, ...S.btnSecondary }}>
              {importBusy && !importPreview ? 'Previewing…' : 'Preview'}
            </button>
            {importPreview && (
              <button onClick={commitImport} disabled={importBusy} style={{ ...S.btn, ...S.btnPrimary }}>
                {importBusy ? 'Importing…' : `Commit (${importPreview.showfiles}sf · ${importPreview.events}ev · ${importPreview.versions}ver)`}
              </button>
            )}
          </div>
          {importMsg && <div style={{ fontSize: '12px', color: importMsg.startsWith('Imported') ? T.green : T.red, marginTop: '8px', fontFamily: fonts.mono }}>{importMsg}</div>}
          {importPreview && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: '8px', fontSize: '12px', color: T.textBody, fontFamily: fonts.mono }}>
              Would create: <strong style={{ color: T.text }}>{importPreview.showfiles}</strong> showfiles,{' '}
              <strong style={{ color: T.text }}>{importPreview.events}</strong> events,{' '}
              <strong style={{ color: T.text }}>{importPreview.versions}</strong> versions
              {importPreview.skipped > 0 && <> · <span style={{ color: T.amber }}>{importPreview.skipped} skipped</span></>}
            </div>
          )}
        </div>
      </div>

      {/* Auth */}
      <div style={{ ...S.card }}>
        <h3 style={cardTitle(T)}>Authentication</h3>
        {isOpenMode() ? (
          <p style={{ fontSize: '13px', color: T.textBody, lineHeight: 1.6 }}>
            <span style={{ ...styles(T).pill, background: T.amberDim, color: T.amber, border: `1px solid ${T.amberBorder}`, marginRight: '8px' }}>open mode</span>
            No password required. To gate the app, set <code style={kbd(T)}>AUTH_PASSWORD</code> in your environment and restart.
            Useful for fork-and-run development. Don't deploy to the public internet without it.
          </p>
        ) : (
          <p style={{ fontSize: '13px', color: T.textBody, lineHeight: 1.6 }}>
            <span style={{ ...styles(T).pill, background: T.greenDim, color: T.green, border: `1px solid ${T.greenBorder}`, marginRight: '8px' }}>gated</span>
            Auth enabled via <code style={kbd(T)}>AUTH_PASSWORD</code> env var. Sessions last 7 days. To rotate the password, change the env var and restart the server — existing sessions remain valid until cookie expiry.
          </p>
        )}
      </div>

      {/* DB file */}
      <div style={{ ...S.card }}>
        <h3 style={cardTitle(T)}>Database</h3>
        <p style={{ fontSize: '13px', color: T.textBody, lineHeight: 1.6, marginBottom: '8px' }}>
          Your data lives in a single SQLite file. Back it up the same way you back up everything else.
        </p>
        <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: T.text, background: T.bg, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: '6px', wordBreak: 'break-all' }}>
          {stats && stats.db_path ? stats.db_path : 'showfiles.db'}
        </div>
        <p style={{ fontSize: '12px', color: T.textDim, marginTop: '8px' }}>
          Override with the <code style={kbd(T)}>SHOWFILES_DB</code> env var.
        </p>
      </div>
    </div>
  );
}

function StatTile({ T, label, value }) {
  return (
    <div style={{ padding: '10px 14px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: '10px' }}>
      <div style={{ fontSize: '11px', color: T.textDim, fontFamily: fonts.mono, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 600, color: T.text }}>{value ?? 0}</div>
    </div>
  );
}

function cardTitle(T) {
  return {
    fontSize: '13px',
    fontWeight: 600,
    color: T.text,
    fontFamily: fonts.mono,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: '12px',
  };
}

function kbd(T) {
  return {
    background: T.surfaceAlt,
    color: T.text,
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: fonts.mono,
    border: `1px solid ${T.border}`,
  };
}

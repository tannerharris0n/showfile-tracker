import { useEffect, useState, useCallback } from 'react';
import { getTheme, setThemeMode, initTheme, fonts, baseStyles } from './theme.js';
import { checkAuth, login, logout, isOpenMode } from './api.js';
import Library from './Library.jsx';
import Events from './Events.jsx';
import AddShowfile from './AddShowfile.jsx';
import AddEvent from './AddEvent.jsx';
import Settings from './Settings.jsx';
import ShowfileDetail from './ShowfileDetail.jsx';

const TABS = [
  { id: 'library', label: 'Library' },
  { id: 'events', label: 'Events' },
  { id: 'add', label: '+ Add' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [theme, setThemeState] = useState(() => initTheme());
  const [authState, setAuthState] = useState({ checked: false, authenticated: false, openMode: false });
  const [tab, setTab] = useState('library');
  const [addMode, setAddMode] = useState('showfile'); // showfile | event
  const [detailId, setDetailId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const T = theme;

  useEffect(() => {
    checkAuth().then((s) => setAuthState({ checked: true, ...s }));
  }, []);

  function toggleTheme() {
    const next = T.mode === 'dark' ? 'light' : 'dark';
    setThemeState(setThemeMode(next));
  }

  const goDetail = useCallback((id) => {
    setDetailId(id);
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (!authState.checked) {
    return (
      <>
        <style>{baseStyles(T)}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: T.textDim, fontFamily: fonts.body }}>
          Loading…
        </div>
      </>
    );
  }

  if (!authState.authenticated) {
    return <LoginScreen T={T} onLogin={async (pw) => {
      const res = await login(pw);
      if (res.ok) {
        const s = await checkAuth();
        setAuthState({ checked: true, ...s });
      }
      return res;
    }} />;
  }

  return (
    <>
      <style>{baseStyles(T)}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 80px', fontFamily: fonts.body }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontSize: '24px', fontWeight: 700, color: T.text, margin: '0 0 4px',
              letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: T.accent, boxShadow: `0 0 12px ${T.accent}` }} />
              Showfile Tracker
            </h1>
            <p style={{ fontSize: '13px', color: T.textDim, margin: 0 }}>
              Lighting designers' showfile metadata library
              {isOpenMode() ? <span style={{ color: T.amber, marginLeft: '8px' }}>· open mode</span> : null}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={toggleTheme} style={{
              padding: '8px 12px', background: T.surface, border: `1px solid ${T.border}`,
              color: T.textDim, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: fonts.body,
            }}>
              {T.mode === 'dark' ? '☼ light' : '☾ dark'}
            </button>
            {!isOpenMode() && (
              <button onClick={async () => { await logout(); window.location.reload(); }} style={{
                padding: '8px 12px', background: T.surface, border: `1px solid ${T.border}`,
                color: T.textDim, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: fonts.body,
              }}>logout</button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <nav style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${T.border}`, marginBottom: '28px' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setDetailId(null); }} style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? T.accent : 'transparent'}`,
              color: tab === t.id ? T.text : T.textDim,
              fontWeight: tab === t.id ? 600 : 500,
              fontSize: '14px',
              cursor: 'pointer',
              marginBottom: '-1px',
              fontFamily: fonts.body,
              transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </nav>

        {/* Body */}
        {detailId ? (
          <ShowfileDetail T={T} id={detailId} onBack={() => setDetailId(null)} onChange={refresh} key={detailId + ':' + refreshKey} />
        ) : tab === 'library' ? (
          <Library T={T} onOpen={goDetail} refreshKey={refreshKey} />
        ) : tab === 'events' ? (
          <Events T={T} onOpenShowfile={goDetail} refreshKey={refreshKey} />
        ) : tab === 'add' ? (
          <AddPanel T={T} mode={addMode} setMode={setAddMode} onDone={(id) => {
            refresh();
            if (id) { setDetailId(id); }
            else { setTab('library'); }
          }} />
        ) : (
          <Settings T={T} onChange={refresh} />
        )}

        <footer style={{ marginTop: '64px', paddingTop: '24px', borderTop: `1px solid ${T.border}`, color: T.textFaint, fontSize: '12px', textAlign: 'center' }}>
          Built by Tanner Harrison · NW Lighting · MIT licensed ·{' '}
          <a href="https://github.com/tannerharrison/showfile-tracker" style={{ color: T.textDim, borderBottom: `1px dotted ${T.border}` }}>GitHub</a>
        </footer>
      </div>
    </>
  );
}

function AddPanel({ T, mode, setMode, onDone }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button onClick={() => setMode('showfile')} style={chipStyle(T, mode === 'showfile')}>+ New showfile</button>
        <button onClick={() => setMode('event')} style={chipStyle(T, mode === 'event')}>+ New event</button>
      </div>
      {mode === 'showfile'
        ? <AddShowfile T={T} onSaved={onDone} />
        : <AddEvent T={T} onSaved={() => onDone(null)} />}
    </div>
  );
}

function chipStyle(T, active) {
  return {
    padding: '8px 14px',
    background: active ? T.accent : T.surface,
    color: active ? T.accentText : T.text,
    border: `1px solid ${active ? T.accent : T.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: fonts.body,
    fontWeight: 500,
  };
}

function LoginScreen({ T, onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await onLogin(pw);
    setBusy(false);
    if (!r.ok) setErr(r.error || 'Login failed');
  }
  return (
    <>
      <style>{baseStyles(T)}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', fontFamily: fonts.body }}>
        <form onSubmit={submit} style={{
          width: '100%', maxWidth: '360px', padding: '32px',
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: '14px',
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: T.text, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: T.accent, boxShadow: `0 0 12px ${T.accent}` }} />
            Showfile Tracker
          </h1>
          <p style={{ fontSize: '13px', color: T.textDim, marginBottom: '20px' }}>Password required.</p>
          <input
            type="password"
            autoFocus
            placeholder="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px',
              background: T.bg, color: T.text,
              border: `1px solid ${T.border}`, borderRadius: '8px',
              fontSize: '14px', fontFamily: fonts.body, marginBottom: '12px',
            }}
          />
          {err && <div style={{ color: T.red, fontSize: '13px', marginBottom: '12px' }}>{err}</div>}
          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '11px',
            background: T.accent, color: T.accentText,
            border: 'none', borderRadius: '8px',
            cursor: busy ? 'wait' : 'pointer',
            fontWeight: 600, fontSize: '14px', fontFamily: fonts.body,
          }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </>
  );
}

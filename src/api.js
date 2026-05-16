// ╔══════════════════════════════════════════════════════════════╗
// ║  API client — talks to /api/* on the local server            ║
// ║                                                              ║
// ║  Auth model matches adhd-tools: session cookie + CSRF token. ║
// ║  In open mode (no AUTH_PASSWORD on server) the server still  ║
// ║  returns csrf_token="open-mode" and accepts everything.      ║
// ╚══════════════════════════════════════════════════════════════╝

let csrfToken = null;
let openMode = false;

export function setCsrfToken(t) { csrfToken = t; }
export function isOpenMode() { return openMode; }

export async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check', { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated) {
      csrfToken = data.csrf_token || null;
      openMode = !!data.open_mode;
      return { authenticated: true, openMode };
    }
    return { authenticated: false, openMode: false };
  } catch {
    return { authenticated: false, openMode: false };
  }
}

export async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (data.ok) {
    csrfToken = data.csrf_token || null;
    openMode = !!data.open_mode;
    return { ok: true };
  }
  return { ok: false, error: data.error || 'Login failed' };
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  csrfToken = null;
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken || '',
    ...extra,
  };
}

async function req(method, path, body) {
  const opts = { method, credentials: 'include', headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  // Some endpoints return CSV — caller can choose to use .text()
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('application/json') >= 0) return res.json();
  return res.text();
}

export const api = {
  // showfiles
  listShowfiles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', '/showfiles' + (q ? '?' + q : ''));
  },
  getShowfile: (id) => req('GET', '/showfiles/' + id),
  createShowfile: (data) => req('POST', '/showfiles', data),
  updateShowfile: (id, data) => req('PATCH', '/showfiles/' + id, data),
  archiveShowfile: (id) => req('POST', '/showfiles/' + id + '/archive'),
  restoreShowfile: (id) => req('POST', '/showfiles/' + id + '/restore'),
  deleteShowfile: (id) => req('DELETE', '/showfiles/' + id + '?confirm=true'),

  // events
  listEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', '/events' + (q ? '?' + q : ''));
  },
  createEvent: (data) => req('POST', '/events', data),
  updateEvent: (id, data) => req('PATCH', '/events/' + id, data),
  deleteEvent: (id) => req('DELETE', '/events/' + id),

  // versions
  listVersions: (showfileId) => req('GET', '/showfiles/' + showfileId + '/versions'),
  createVersion: (showfileId, data) => req('POST', '/showfiles/' + showfileId + '/versions', data),
  deleteVersion: (id) => req('DELETE', '/versions/' + id),

  // stats + import/export
  stats: () => req('GET', '/stats'),
  exportCsvUrl: '/api/export/csv',
  importCsv: (csvText, dryRun) => {
    const q = dryRun ? '?dry=1' : '';
    return req('POST', '/import/csv' + q, { csv: csvText });
  },
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  DB — better-sqlite3, single-file, auto-migrating schema     ║
// ║                                                              ║
// ║  Schema applies on every server boot (idempotent CREATEs).   ║
// ║  DB path: SHOWFILES_DB env or ./showfiles.db                 ║
// ╚══════════════════════════════════════════════════════════════╝

var path = require('path');
var fs = require('fs');
var Database = require('better-sqlite3');
var crypto = require('crypto');

var DB_PATH = process.env.SHOWFILES_DB || path.join(__dirname, '..', 'showfiles.db');

// Ensure parent dir exists (in case user pointed env to a nested path)
try {
  var dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
} catch (e) {
  console.warn('[db] could not pre-create dir for', DB_PATH, e.message);
}

var db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

var SCHEMA = `
CREATE TABLE IF NOT EXISTS showfiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  console_family TEXT NOT NULL,
  console_version TEXT,
  file_format TEXT,
  external_url TEXT,
  storage_location_label TEXT,
  client TEXT,
  venue TEXT,
  rig_summary TEXT,
  notes TEXT,
  tags TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS showfiles_console_idx ON showfiles(console_family);
CREATE INDEX IF NOT EXISTS showfiles_archived_idx ON showfiles(archived, last_used_at DESC);
CREATE INDEX IF NOT EXISTS showfiles_client_idx ON showfiles(client);

CREATE TABLE IF NOT EXISTS showfile_events (
  id TEXT PRIMARY KEY,
  showfile_id TEXT NOT NULL REFERENCES showfiles(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  venue TEXT,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'backup', 'derived_from')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_showfile_idx ON showfile_events(showfile_id, event_date DESC);
CREATE INDEX IF NOT EXISTS events_date_idx ON showfile_events(event_date DESC);

CREATE TABLE IF NOT EXISTS showfile_versions (
  id TEXT PRIMARY KEY,
  showfile_id TEXT NOT NULL REFERENCES showfiles(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  external_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS versions_showfile_idx ON showfile_versions(showfile_id, created_at DESC);
`;

db.exec(SCHEMA);

// Log table state on boot
try {
  var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(function (r) { return r.name; });
  console.log('[db] ready at ' + DB_PATH);
  console.log('[db] tables: ' + tables.join(', '));
} catch (e) {
  console.warn('[db] could not enumerate tables:', e.message);
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function uuid() {
  // RFC 4122 v4
  return crypto.randomUUID();
}

function recomputeLastUsedAt(showfileId) {
  var row = db.prepare('SELECT MAX(event_date) AS last FROM showfile_events WHERE showfile_id = ?').get(showfileId);
  var last = row && row.last ? row.last : null;
  db.prepare('UPDATE showfiles SET last_used_at = ?, updated_at = datetime(\'now\') WHERE id = ?').run(last, showfileId);
  return last;
}

function touchShowfile(showfileId) {
  db.prepare('UPDATE showfiles SET updated_at = datetime(\'now\') WHERE id = ?').run(showfileId);
}

module.exports = {
  db: db,
  DB_PATH: DB_PATH,
  uuid: uuid,
  recomputeLastUsedAt: recomputeLastUsedAt,
  touchShowfile: touchShowfile,
};

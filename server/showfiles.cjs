// ╔══════════════════════════════════════════════════════════════╗
// ║  SHOWFILES — Express router                                  ║
// ║                                                              ║
// ║  Endpoints:                                                  ║
// ║    GET    /showfiles                  filtered list          ║
// ║    GET    /showfiles/:id              detail + events + ver  ║
// ║    POST   /showfiles                                         ║
// ║    PATCH  /showfiles/:id                                     ║
// ║    POST   /showfiles/:id/archive                             ║
// ║    POST   /showfiles/:id/restore                             ║
// ║    DELETE /showfiles/:id?confirm=true                        ║
// ║                                                              ║
// ║    GET    /events                     filtered list w/ join  ║
// ║    POST   /events                                            ║
// ║    PATCH  /events/:id                                        ║
// ║    DELETE /events/:id                                        ║
// ║                                                              ║
// ║    GET    /showfiles/:id/versions                            ║
// ║    POST   /showfiles/:id/versions                            ║
// ║    DELETE /versions/:id                                      ║
// ║                                                              ║
// ║    GET    /stats                                             ║
// ╚══════════════════════════════════════════════════════════════╝

var express = require('express');
var dbMod = require('./db.cjs');
var db = dbMod.db;
var uuid = dbMod.uuid;
var recomputeLastUsedAt = dbMod.recomputeLastUsedAt;

var router = express.Router();

var CONSOLE_FAMILIES = ['eos', 'ma2', 'ma3', 'avolites', 'hog4', 'chamsys', 'onyx', 'other'];
var ROLES = ['primary', 'backup', 'derived_from'];

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function wrap(fn) {
  return function (req, res) {
    try {
      fn(req, res);
    } catch (err) {
      console.error('[showfiles]', err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
  };
}

function cleanString(v) {
  if (v == null) return null;
  var s = String(v).trim();
  return s.length === 0 ? null : s;
}

function normalizeConsole(raw) {
  var s = (raw || '').toString().toLowerCase().trim();
  if (CONSOLE_FAMILIES.indexOf(s) >= 0) return s;
  return 'other';
}

function normalizeRole(raw) {
  var s = (raw || '').toString().toLowerCase().trim();
  if (ROLES.indexOf(s) >= 0) return s;
  return 'primary';
}

function isoDate(raw) {
  if (!raw) return null;
  var s = String(raw).trim();
  // accept YYYY-MM-DD or full ISO; pass through after sanity check
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ==========================================================
// SHOWFILES
// ==========================================================

router.get('/showfiles', wrap(function (req, res) {
  var archived = req.query.archived === 'true' ? 1 : (req.query.archived === 'all' ? null : 0);
  var consoleFamily = req.query.console ? String(req.query.console).toLowerCase() : null;
  var client = req.query.client ? String(req.query.client) : null;
  var q = req.query.q ? String(req.query.q).toLowerCase() : null;

  var sql = 'SELECT * FROM showfiles WHERE 1=1';
  var params = [];
  if (archived !== null) { sql += ' AND archived = ?'; params.push(archived); }
  if (consoleFamily) { sql += ' AND console_family = ?'; params.push(consoleFamily); }
  if (client) { sql += ' AND client = ?'; params.push(client); }
  sql += ' ORDER BY (last_used_at IS NULL), last_used_at DESC, updated_at DESC';

  var rows = db.prepare(sql).all(params);

  if (q) {
    rows = rows.filter(function (s) {
      var haystack = [s.name, s.venue, s.client, s.notes, s.tags, s.rig_summary, s.console_version]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  // attach event counts in a single query
  var counts = db.prepare('SELECT showfile_id, COUNT(*) AS n FROM showfile_events GROUP BY showfile_id').all();
  var countMap = {};
  counts.forEach(function (r) { countMap[r.showfile_id] = r.n; });
  rows.forEach(function (r) { r.event_count = countMap[r.id] || 0; });

  res.json({ showfiles: rows });
}));

router.get('/showfiles/:id', wrap(function (req, res) {
  var sf = db.prepare('SELECT * FROM showfiles WHERE id = ?').get(req.params.id);
  if (!sf) return res.status(404).json({ error: 'Not found' });
  var events = db.prepare('SELECT * FROM showfile_events WHERE showfile_id = ? ORDER BY event_date DESC').all(req.params.id);
  var versions = db.prepare('SELECT * FROM showfile_versions WHERE showfile_id = ? ORDER BY created_at DESC').all(req.params.id);
  sf.events = events;
  sf.versions = versions;
  sf.event_count = events.length;
  res.json({ showfile: sf });
}));

router.post('/showfiles', wrap(function (req, res) {
  var b = req.body || {};
  var name = cleanString(b.name);
  if (!name) return res.status(400).json({ error: 'name_required' });

  var id = uuid();
  db.prepare(`
    INSERT INTO showfiles (
      id, name, console_family, console_version, file_format,
      external_url, storage_location_label, client, venue,
      rig_summary, notes, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    normalizeConsole(b.console_family),
    cleanString(b.console_version),
    cleanString(b.file_format),
    cleanString(b.external_url),
    cleanString(b.storage_location_label),
    cleanString(b.client),
    cleanString(b.venue),
    cleanString(b.rig_summary),
    cleanString(b.notes),
    cleanString(b.tags)
  );
  var row = db.prepare('SELECT * FROM showfiles WHERE id = ?').get(id);
  res.json({ showfile: row });
}));

router.patch('/showfiles/:id', wrap(function (req, res) {
  var existing = db.prepare('SELECT * FROM showfiles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  var b = req.body || {};
  var fields = [];
  var params = [];
  var allowed = {
    name: cleanString,
    console_family: normalizeConsole,
    console_version: cleanString,
    file_format: cleanString,
    external_url: cleanString,
    storage_location_label: cleanString,
    client: cleanString,
    venue: cleanString,
    rig_summary: cleanString,
    notes: cleanString,
    tags: cleanString,
  };
  Object.keys(allowed).forEach(function (k) {
    if (k in b) {
      fields.push(k + ' = ?');
      params.push(allowed[k](b[k]));
    }
  });
  if (!fields.length) return res.status(400).json({ error: 'no_fields' });
  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare('UPDATE showfiles SET ' + fields.join(', ') + ' WHERE id = ?').run(params);
  var row = db.prepare('SELECT * FROM showfiles WHERE id = ?').get(req.params.id);
  res.json({ showfile: row });
}));

router.post('/showfiles/:id/archive', wrap(function (req, res) {
  var info = db.prepare("UPDATE showfiles SET archived = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

router.post('/showfiles/:id/restore', wrap(function (req, res) {
  var info = db.prepare("UPDATE showfiles SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

router.delete('/showfiles/:id', wrap(function (req, res) {
  if (req.query.confirm !== 'true') {
    return res.status(400).json({ error: 'confirm=true required (this hard-deletes showfile + all linked events + versions)' });
  }
  var info = db.prepare('DELETE FROM showfiles WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

// ==========================================================
// EVENTS
// ==========================================================

router.get('/events', wrap(function (req, res) {
  var from = req.query.from ? isoDate(req.query.from) : null;
  var to = req.query.to ? isoDate(req.query.to) : null;
  var showfileId = req.query.showfile_id || null;

  var sql = `
    SELECT e.*, s.name AS showfile_name, s.console_family AS showfile_console
    FROM showfile_events e
    LEFT JOIN showfiles s ON s.id = e.showfile_id
    WHERE 1=1
  `;
  var params = [];
  if (from) { sql += ' AND e.event_date >= ?'; params.push(from); }
  if (to) { sql += ' AND e.event_date <= ?'; params.push(to); }
  if (showfileId) { sql += ' AND e.showfile_id = ?'; params.push(showfileId); }
  sql += ' ORDER BY e.event_date DESC, e.created_at DESC LIMIT 2000';

  var rows = db.prepare(sql).all(params);
  res.json({ events: rows });
}));

router.post('/events', wrap(function (req, res) {
  var b = req.body || {};
  var showfileId = cleanString(b.showfile_id);
  var eventName = cleanString(b.event_name);
  var eventDate = isoDate(b.event_date);
  if (!showfileId || !eventName || !eventDate) {
    return res.status(400).json({ error: 'showfile_id, event_name, event_date all required' });
  }
  var sf = db.prepare('SELECT id FROM showfiles WHERE id = ?').get(showfileId);
  if (!sf) return res.status(404).json({ error: 'showfile_not_found' });

  var id = uuid();
  db.prepare(`
    INSERT INTO showfile_events (id, showfile_id, event_name, event_date, venue, role, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, showfileId, eventName, eventDate, cleanString(b.venue), normalizeRole(b.role), cleanString(b.notes));

  recomputeLastUsedAt(showfileId);

  var row = db.prepare('SELECT * FROM showfile_events WHERE id = ?').get(id);
  res.json({ event: row });
}));

router.patch('/events/:id', wrap(function (req, res) {
  var existing = db.prepare('SELECT * FROM showfile_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  var b = req.body || {};
  var fields = [];
  var params = [];
  if ('event_name' in b) { fields.push('event_name = ?'); params.push(cleanString(b.event_name)); }
  if ('event_date' in b) { fields.push('event_date = ?'); params.push(isoDate(b.event_date)); }
  if ('venue' in b) { fields.push('venue = ?'); params.push(cleanString(b.venue)); }
  if ('role' in b) { fields.push('role = ?'); params.push(normalizeRole(b.role)); }
  if ('notes' in b) { fields.push('notes = ?'); params.push(cleanString(b.notes)); }
  if (!fields.length) return res.status(400).json({ error: 'no_fields' });
  params.push(req.params.id);
  db.prepare('UPDATE showfile_events SET ' + fields.join(', ') + ' WHERE id = ?').run(params);
  recomputeLastUsedAt(existing.showfile_id);
  var row = db.prepare('SELECT * FROM showfile_events WHERE id = ?').get(req.params.id);
  res.json({ event: row });
}));

router.delete('/events/:id', wrap(function (req, res) {
  var existing = db.prepare('SELECT * FROM showfile_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM showfile_events WHERE id = ?').run(req.params.id);
  recomputeLastUsedAt(existing.showfile_id);
  res.json({ ok: true });
}));

// ==========================================================
// VERSIONS
// ==========================================================

router.get('/showfiles/:id/versions', wrap(function (req, res) {
  var rows = db.prepare('SELECT * FROM showfile_versions WHERE showfile_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ versions: rows });
}));

router.post('/showfiles/:id/versions', wrap(function (req, res) {
  var sf = db.prepare('SELECT id FROM showfiles WHERE id = ?').get(req.params.id);
  if (!sf) return res.status(404).json({ error: 'showfile_not_found' });
  var b = req.body || {};
  var label = cleanString(b.version_label);
  if (!label) return res.status(400).json({ error: 'version_label_required' });
  var id = uuid();
  db.prepare(`
    INSERT INTO showfile_versions (id, showfile_id, version_label, external_url, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.id, label, cleanString(b.external_url), cleanString(b.notes));
  var row = db.prepare('SELECT * FROM showfile_versions WHERE id = ?').get(id);
  res.json({ version: row });
}));

router.delete('/versions/:id', wrap(function (req, res) {
  var info = db.prepare('DELETE FROM showfile_versions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

// ==========================================================
// STATS
// ==========================================================

router.get('/stats', wrap(function (req, res) {
  var active = db.prepare('SELECT COUNT(*) AS n FROM showfiles WHERE archived = 0').get().n;
  var archived = db.prepare('SELECT COUNT(*) AS n FROM showfiles WHERE archived = 1').get().n;
  var events = db.prepare('SELECT COUNT(*) AS n FROM showfile_events').get().n;
  var versions = db.prepare('SELECT COUNT(*) AS n FROM showfile_versions').get().n;
  var oldest = db.prepare('SELECT MIN(event_date) AS d FROM showfile_events').get().d;
  var newest = db.prepare('SELECT MAX(event_date) AS d FROM showfile_events').get().d;
  var byConsole = db.prepare('SELECT console_family, COUNT(*) AS n FROM showfiles WHERE archived = 0 GROUP BY console_family ORDER BY n DESC').all();
  res.json({
    showfiles_active: active,
    showfiles_archived: archived,
    events: events,
    versions: versions,
    oldest_event_date: oldest,
    newest_event_date: newest,
    by_console: byConsole,
    db_path: dbMod.DB_PATH,
  });
}));

module.exports = router;

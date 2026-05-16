// ╔══════════════════════════════════════════════════════════════╗
// ║  IMPORT-EXPORT — Express router                              ║
// ║                                                              ║
// ║  GET  /export/csv          ← single CSV: showfiles + events  ║
// ║  POST /import/csv?dry=1    ← preview-only counts             ║
// ║  POST /import/csv          ← commit (creates showfiles+events)║
// ║                                                              ║
// ║  Format: one CSV with a "row_type" column. row_type=showfile ║
// ║  rows contain showfile fields; row_type=event rows reference ║
// ║  a showfile via external_id (showfile.id) OR by name match.  ║
// ╚══════════════════════════════════════════════════════════════╝

var express = require('express');
var dbMod = require('./db.cjs');
var db = dbMod.db;
var uuid = dbMod.uuid;
var recomputeLastUsedAt = dbMod.recomputeLastUsedAt;

var router = express.Router();

// ──────────────────────────────────────────────────────────
// CSV utilities
// ──────────────────────────────────────────────────────────

function csvCell(v) {
  if (v == null) return '';
  var s = String(v);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCsv(text) {
  var rows = [], row = [], field = '', inQuotes = false, i = 0;
  while (i < text.length) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
      field += c; i++;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ──────────────────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────────────────

var EXPORT_HEADERS = [
  'row_type', 'id', 'showfile_id', 'name', 'console_family', 'console_version',
  'file_format', 'external_url', 'storage_location_label', 'client', 'venue',
  'rig_summary', 'notes', 'tags', 'archived',
  'event_name', 'event_date', 'event_venue', 'event_role', 'event_notes',
  'version_label', 'version_external_url', 'version_notes',
  'created_at', 'updated_at', 'last_used_at',
];

router.get('/export/csv', function (req, res) {
  try {
    var showfiles = db.prepare('SELECT * FROM showfiles ORDER BY name ASC').all();
    var events = db.prepare('SELECT * FROM showfile_events ORDER BY event_date ASC').all();
    var versions = db.prepare('SELECT * FROM showfile_versions ORDER BY created_at ASC').all();

    var lines = [EXPORT_HEADERS.join(',')];

    showfiles.forEach(function (s) {
      var row = [
        'showfile', s.id, '',
        s.name, s.console_family, s.console_version,
        s.file_format, s.external_url, s.storage_location_label,
        s.client, s.venue, s.rig_summary, s.notes, s.tags, s.archived,
        '', '', '', '', '',
        '', '', '',
        s.created_at, s.updated_at, s.last_used_at,
      ];
      lines.push(row.map(csvCell).join(','));
    });

    events.forEach(function (e) {
      var row = [
        'event', e.id, e.showfile_id,
        '', '', '', '', '', '', '', '', '', '', '', '',
        e.event_name, e.event_date, e.venue, e.role, e.notes,
        '', '', '',
        e.created_at, '', '',
      ];
      lines.push(row.map(csvCell).join(','));
    });

    versions.forEach(function (v) {
      var row = [
        'version', v.id, v.showfile_id,
        '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '',
        v.version_label, v.external_url, v.notes,
        v.created_at, '', '',
      ];
      lines.push(row.map(csvCell).join(','));
    });

    var filename = 'showfile-tracker-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('[export/csv]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// IMPORT
// ──────────────────────────────────────────────────────────

router.post('/import/csv', function (req, res) {
  try {
    var b = req.body || {};
    var text = b.csv || (typeof b === 'string' ? b : '');
    if (!text) return res.status(400).json({ error: 'csv_required (send {"csv": "...full csv text..."} or set Content-Type: text/csv)' });

    var rows = parseCsv(text);
    if (rows.length < 2) return res.json({ showfiles: 0, events: 0, versions: 0, dry_run: true, message: 'empty CSV' });

    var headers = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    function get(row, key) {
      var k = key.toLowerCase();
      if (idx[k] == null) return null;
      var v = row[idx[k]];
      return v == null || String(v).trim() === '' ? null : String(v).trim();
    }

    var dryRun = req.query.dry === '1' || req.query.dry === 'true' || b.dry_run === true;
    var counts = { showfiles: 0, events: 0, versions: 0, skipped: 0 };

    // Build a name → id map for events that reference by name only
    var existingByName = {};
    db.prepare('SELECT id, name FROM showfiles').all().forEach(function (r) {
      existingByName[r.name.toLowerCase()] = r.id;
    });

    // Pre-scan to plan IDs (so events in this CSV can resolve showfiles in this CSV)
    var planned = {}; // old/csv id → new id
    var plannedByName = {};
    for (var p = 1; p < rows.length; p++) {
      var pr = rows[p];
      var rt = (get(pr, 'row_type') || '').toLowerCase();
      if (rt === 'showfile') {
        var oldId = get(pr, 'id');
        var nm = get(pr, 'name');
        var newId = uuid();
        if (oldId) planned[oldId] = newId;
        if (nm) plannedByName[nm.toLowerCase()] = newId;
      }
    }

    var work = db.transaction(function () {
      var insSf = db.prepare(`
        INSERT INTO showfiles (
          id, name, console_family, console_version, file_format,
          external_url, storage_location_label, client, venue,
          rig_summary, notes, tags, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      var insEv = db.prepare(`
        INSERT INTO showfile_events (
          id, showfile_id, event_name, event_date, venue, role, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      var insVer = db.prepare(`
        INSERT INTO showfile_versions (
          id, showfile_id, version_label, external_url, notes
        ) VALUES (?, ?, ?, ?, ?)
      `);

      var touchedShowfiles = {};

      for (var r = 1; r < rows.length; r++) {
        var row = rows[r];
        if (!row || row.every(function (v) { return !v || !String(v).trim(); })) continue;
        var rt = (get(row, 'row_type') || '').toLowerCase();

        if (rt === 'showfile') {
          var name = get(row, 'name');
          if (!name) { counts.skipped++; continue; }
          var oldId = get(row, 'id');
          var newId = (oldId && planned[oldId]) || planned[oldId] || plannedByName[name.toLowerCase()] || uuid();
          var archivedVal = get(row, 'archived');
          if (!dryRun) {
            insSf.run(
              newId, name,
              (get(row, 'console_family') || 'other').toLowerCase(),
              get(row, 'console_version'),
              get(row, 'file_format'),
              get(row, 'external_url'),
              get(row, 'storage_location_label'),
              get(row, 'client'),
              get(row, 'venue'),
              get(row, 'rig_summary'),
              get(row, 'notes'),
              get(row, 'tags'),
              archivedVal && (archivedVal === '1' || archivedVal.toLowerCase() === 'true') ? 1 : 0
            );
            existingByName[name.toLowerCase()] = newId;
          }
          counts.showfiles++;
        } else if (rt === 'event') {
          var refOldId = get(row, 'showfile_id');
          var sfId = (refOldId && planned[refOldId]) || existingByName[(get(row, 'name') || '').toLowerCase()];
          // also support a "showfile_name" lookup
          if (!sfId) {
            var sn = get(row, 'showfile_name');
            if (sn) sfId = existingByName[sn.toLowerCase()] || plannedByName[sn.toLowerCase()];
          }
          var ev = get(row, 'event_name');
          var ed = get(row, 'event_date');
          if (!sfId || !ev || !ed) { counts.skipped++; continue; }
          if (!dryRun) {
            insEv.run(
              uuid(), sfId, ev, ed.slice(0, 10),
              get(row, 'event_venue'),
              (get(row, 'event_role') || 'primary').toLowerCase(),
              get(row, 'event_notes')
            );
            touchedShowfiles[sfId] = true;
          }
          counts.events++;
        } else if (rt === 'version') {
          var refOldId2 = get(row, 'showfile_id');
          var sfId2 = (refOldId2 && planned[refOldId2]) || existingByName[(get(row, 'showfile_name') || '').toLowerCase()];
          var label = get(row, 'version_label');
          if (!sfId2 || !label) { counts.skipped++; continue; }
          if (!dryRun) {
            insVer.run(
              uuid(), sfId2, label,
              get(row, 'version_external_url'),
              get(row, 'version_notes')
            );
          }
          counts.versions++;
        } else {
          counts.skipped++;
        }
      }

      if (!dryRun) {
        Object.keys(touchedShowfiles).forEach(function (id) { recomputeLastUsedAt(id); });
      }
    });

    if (dryRun) {
      // pretend-run: do the same counting but skip writes (the transaction with writes guarded above)
      work();
      return res.json({ dry_run: true, showfiles: counts.showfiles, events: counts.events, versions: counts.versions, skipped: counts.skipped });
    }

    work();
    res.json({ dry_run: false, showfiles: counts.showfiles, events: counts.events, versions: counts.versions, skipped: counts.skipped });
  } catch (err) {
    console.error('[import/csv]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

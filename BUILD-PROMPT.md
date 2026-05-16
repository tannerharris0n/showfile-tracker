# Build: Showfile Tracker (standalone, shareable on GitHub)

You are building a complete standalone React + Vite + Express app at `C:\Projects\showfile-tracker\`. This is the entire scope of your session.

## What it does
**Lighting designers' showfile metadata library**. Track every showfile across every gig: which file goes with which event, when last used, what console it ran on, what venue, what gear was rigged, version notes. v1 stores **metadata only + an external link** to where the file actually lives (Dropbox, iCloud Drive, Google Drive, OneDrive, USB stash). v2 could add real file uploads, but that needs durable object storage which complicates the open-source story.

Built for **Tanner Harrison** (12+ years professional LD, NW Lighting) but **shipped as an open-source project** for working LDs, programmers, students, and small production companies. The pain it solves: "where's the showfile for the church gig last September on the Eos Ti?" — currently solved with sticky notes, badly-named folders, and memory.

## Architectural decisions (already made)
- **SQLite** (`better-sqlite3`) — single-file DB, fork-friendly, zero setup. Schema auto-migrates on boot.
- **Vite + React 18 + Express**, no TypeScript — same family as the other tools.
- **Optional auth**: `AUTH_PASSWORD` env var. Open mode for forkers; gated mode for hosted use.
- **No file uploads in v1.** Files live in user's existing storage; the tool stores the URL.
- **No Anthropic dependency** — this is a pure CRUD app. Skip the Claude proxy in `server.cjs` (or include it dormant for v2 features like "summarize all my Eos shows").
- **CSV import + export** for migration in/out.

## Reference codebase
Sibling repo `C:\Projects\adhd-tools\`:
- `server.cjs` — auth + CSRF + Helmet + rate-limit patterns
- `server/cadence.cjs` — best CRUD reference (contacts + interactions). Schema migration on boot, idempotent. Read this carefully — your DB pattern mirrors it but in sqlite.
- `src/api.js`, `src/theme.js`
- `src/tools/Cadence.jsx` — best UI reference (list + detail + filters + add/edit + archive flow)

## Repo structure
```
showfile-tracker/
  .gitignore               (include showfiles.db, .env, node_modules, dist)
  README.md
  LICENSE                  ← MIT
  package.json             (deps: express, better-sqlite3, helmet, express-rate-limit, cookie-parser, vite, react)
  vite.config.js
  nixpacks.toml
  index.html
  server.cjs
  server/
    db.cjs                 ← sqlite + auto-migrating schema
    showfiles.cjs          ← Router: full CRUD on showfiles + events
    import-export.cjs      ← CSV in/out endpoints
  src/
    main.jsx
    App.jsx                ← MainShell with tabs: Library, Events, Add, Settings
    theme.js               ← Lighting-industry vibe like cue-list-generator (dark default + light toggle, warm amber accent)
    api.js
    Library.jsx            ← Showfile grid/table view with filters
    Events.jsx             ← Event timeline view with linked showfiles
    ShowfileDetail.jsx     ← Single showfile detail / edit
    AddShowfile.jsx        ← New showfile form
    AddEvent.jsx           ← New event form, link to existing or new showfile
    Settings.jsx           ← CSV export, DB stats, theme toggle, AUTH_PASSWORD info
```

## SQLite schema (server/db.cjs)

```sql
CREATE TABLE IF NOT EXISTS showfiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                                     -- e.g., "St. Andrews 2026 Easter"
  console_family TEXT NOT NULL,                           -- 'eos' | 'ma2' | 'ma3' | 'avolites' | 'hog4' | 'chamsys' | 'onyx' | 'other'
  console_version TEXT,                                   -- e.g., "Eos 3.2.4", "MA2 3.9.60"
  file_format TEXT,                                       -- e.g., '.esf', '.show', '.lpx', '.svf', '.cue'
  external_url TEXT,                                      -- Dropbox / iCloud / etc.
  storage_location_label TEXT,                            -- e.g., "Dropbox / NW Lighting / 2026 / Easter"
  client TEXT,                                            -- e.g., "St. Andrews Lutheran"
  venue TEXT,                                             -- e.g., "St. Andrews Lutheran, Tukwila"
  rig_summary TEXT,                                       -- multi-line text describing the rig
  notes TEXT,                                             -- markdown ok
  tags TEXT,                                              -- comma-separated, e.g., "worship,easter,recurring"
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT                                       -- denormalized from latest event for fast sort
);
CREATE INDEX IF NOT EXISTS showfiles_console_idx ON showfiles(console_family);
CREATE INDEX IF NOT EXISTS showfiles_archived_idx ON showfiles(archived, last_used_at DESC);
CREATE INDEX IF NOT EXISTS showfiles_client_idx ON showfiles(client);

CREATE TABLE IF NOT EXISTS showfile_events (
  id TEXT PRIMARY KEY,
  showfile_id TEXT NOT NULL REFERENCES showfiles(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,                               -- ISO date
  venue TEXT,                                             -- override if different from showfile.venue
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'backup', 'derived_from')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_showfile_idx ON showfile_events(showfile_id, event_date DESC);
CREATE INDEX IF NOT EXISTS events_date_idx ON showfile_events(event_date DESC);

CREATE TABLE IF NOT EXISTS showfile_versions (
  -- v1: minimal — just track named versions with their own external URL
  id TEXT PRIMARY KEY,
  showfile_id TEXT NOT NULL REFERENCES showfiles(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,                            -- e.g., "v1.0 — opening night", "v1.1 — added rain look"
  external_url TEXT,                                      -- if user wants per-version URLs
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS versions_showfile_idx ON showfile_versions(showfile_id, created_at DESC);
```

**Auto-migrate on boot**: on every server start, run the schema (CREATE TABLE IF NOT EXISTS is idempotent). On a future schema change, add a separate one-off ALTER step that's also idempotent. Log to console which tables exist.

**`last_used_at` denormalization**: when an event is inserted/updated/deleted for a showfile, recompute the showfile's `last_used_at` to MAX(events.event_date) and write it. Keeps Library sort-by-last-used fast.

## Endpoints (server/showfiles.cjs)

All require session auth + CSRF when `AUTH_PASSWORD` is set. Open mode (no auth) when env var unset.

### Showfiles CRUD
- `GET /api/showfiles?archived=false&console=eos&client=...&q=search` — list with filters + full-text search across name + venue + notes + tags
- `GET /api/showfiles/:id` — single showfile WITH all linked events + versions
- `POST /api/showfiles` — create
- `PATCH /api/showfiles/:id` — partial update
- `POST /api/showfiles/:id/archive` — soft-archive (set archived=1)
- `POST /api/showfiles/:id/restore` — un-archive
- `DELETE /api/showfiles/:id` — hard-delete (require explicit `confirm=true` query param; cascades to events + versions)

### Events CRUD
- `GET /api/events?from=2026-01-01&to=2026-12-31` — events in range, with showfile name joined
- `POST /api/events` — create (also recomputes showfile.last_used_at)
- `PATCH /api/events/:id` — update (recompute on date change)
- `DELETE /api/events/:id` — delete (recompute)

### Versions CRUD
- `GET /api/showfiles/:id/versions` — list versions
- `POST /api/showfiles/:id/versions` — add version
- `DELETE /api/versions/:id` — delete version

### Import/export (server/import-export.cjs)
- `GET /api/export/csv` — full library + events as a single CSV (or zip of two CSVs)
- `POST /api/import/csv` — accepts CSV upload, validates, inserts. Show a dry-run preview first ("12 showfiles, 34 events would be added"). Confirm to commit.

## UI

### Library tab (Library.jsx) — default view
- Top row: search box (full-text), console filter chips (All, Eos, MA2, MA3, Avolites, Hog 4, Chamsys, Onyx, Other), sort dropdown (Last used / Created / Name / Client), "Show archived" toggle.
- Grid or table of showfile cards. Each card shows:
  - Name (large, click → detail)
  - Client + venue
  - Console badge (color-coded per family)
  - Last used date + event count
  - Quick-link icon to external_url (one-click open in new tab)
  - Tags as small pills
  - Archived badge if archived
- "+ Add showfile" button top-right

### Events tab (Events.jsx)
- Calendar OR list view (toggle). Default to list, newest first.
- Filter by date range, by showfile, by venue.
- Each event row: date, event name, venue, linked showfile name (click → detail), role (primary/backup/derived).
- "+ Add event" button top-right

### Showfile detail (ShowfileDetail.jsx)
- All metadata, fully editable inline.
- Big "Open file ↗" button if external_url present, also "Copy URL" + "Copy storage path label".
- Linked events list (date, name, role) with quick add-event button.
- Linked versions list with quick add-version button.
- Notes block (markdown rendered with a simple parser — `marked` is fine; no syntax highlighting needed).
- Bottom: Archive / Delete actions.

### Add Showfile (AddShowfile.jsx)
Form fields:
- Name (required)
- Console family (chips, required)
- Console version (free text, optional but encouraged)
- File format (auto-suggest based on console: Eos → .esf/.lpx, MA → .show, etc.)
- External URL (optional; show paste-detection for Dropbox/iCloud/Google links to format the storage label nicely)
- Storage location label (optional, free text — e.g., "Dropbox / NW Lighting / 2026 / Easter")
- Client (optional)
- Venue (optional)
- Rig summary (textarea, optional)
- Notes (textarea, markdown ok, optional)
- Tags (comma-separated input, optional)
- "Save" + "Save and add an event for this file" buttons

### Add Event (AddEvent.jsx)
- Showfile selector (autocomplete from existing) OR "Create new showfile" link
- Event name (required)
- Event date (required, date picker)
- Venue (optional, prefilled from showfile)
- Role (chips: Primary, Backup, Derived from)
- Notes (optional)

### Settings (Settings.jsx)
- DB stats: total showfiles, events, versions; archived counts; oldest + newest event
- CSV export button (downloads `showfile-tracker-export-YYYY-MM-DD.csv`)
- CSV import (file picker → dry-run preview → confirm)
- Theme toggle (dark/light)
- AUTH_PASSWORD info: "Auth is currently disabled / enabled" + instructions to set the env var
- DB file path display: "Your data is in `showfiles.db` — back this up!"

## Theme
Match cue-list-generator family (dark default, light toggle, warm amber accent) — these are sister tools for the lighting audience.

## README must include
- Tagline: "Open-source showfile metadata library for lighting designers."
- Screenshot of Library + Detail (placeholders OK)
- Why it exists ("currently solved with sticky notes and memory")
- Setup
- Console family support (which families, what level of metadata captured)
- Privacy: SQLite local file. No cloud.
- "v1 stores metadata + external link only — file uploads coming in v2 if there's interest. PRs welcome."
- Console family color guide (so users know what the badges mean)
- License: MIT
- "Built by Tanner Harrison · NW Lighting"

## Out of scope (v1)
- File uploads (just external links to Dropbox/iCloud/etc.)
- File version diffing
- Console-file parsing (reading .esf to extract patch / cue counts)
- Sharing showfiles with other LDs (single-user)
- Mobile-specific UI (responsive but no native app)
- Calendar sync (Apple/Google) — could be v2
- Print views
- Multi-user / multi-tenant

## Build order
1. Scaffold (package.json with `better-sqlite3`, etc.)
2. server/db.cjs — sqlite open + schema migration
3. server.cjs — Express + auth + mount router
4. server/showfiles.cjs — all CRUD endpoints
5. server/import-export.cjs
6. Test endpoints with curl: create a showfile, create an event, list, search
7. Frontend: theme, api, App with tabs
8. Library.jsx (most-used view, build first)
9. ShowfileDetail.jsx
10. AddShowfile.jsx, AddEvent.jsx
11. Events.jsx
12. Settings.jsx with import/export
13. Test end-to-end: add 5 sample showfiles, 8 events, search, archive, export CSV, re-import to a fresh DB
14. README + LICENSE
15. `git init && git commit && gh repo create showfile-tracker --public --source=. --remote=origin --push` (confirm before going public; verify .db is gitignored)

## Done when
- `npm run build` clean
- Sqlite migrations apply cleanly (delete showfiles.db, restart, verify recreate)
- Full CRUD works end-to-end via the UI for showfiles, events, versions
- Search + filter + sort all work on Library
- last_used_at recomputes correctly when events are added/edited/deleted
- CSV export → import round-trips identically (test by exporting, wiping DB, importing, comparing)
- Archived items hidden by default, shown via toggle
- Dark + light themes both work; theme persists in localStorage
- README explains setup completely
- Repo ready to push (verify .db is gitignored)

## Adhd-tools integration
**Currently NOT planned**. NW Lighting work doesn't happen daily and showfile lookup is more naturally done from the standalone tool with its full library view. If integrated later, would use postgres (not sqlite) and join the new `lighting` category in adhd-tools.

## Memory note
See `C:\Users\Tanner\.claude\projects\C--Projects-adhd-tools\memory\project_repo_architecture.md` for the standalone-repo pattern. Showfile Tracker is the most "real app" of the six in the batch — full CRUD, durable storage, search, import/export — making it a strong open-source contribution and a portfolio-quality piece on Tanner's GitHub.

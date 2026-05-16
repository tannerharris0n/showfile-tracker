# Showfile Tracker

> Open-source showfile metadata library for lighting designers.

"Where's the showfile for the church gig last September on the Eos Ti?"

Currently solved with sticky notes, badly-named folders, and the LD's memory. Showfile Tracker is a single-file database + a clean UI to log every showfile, every gig you used it on, the console + version it ran on, the venue, the rig, the notes — and where the actual file lives in your existing storage (Dropbox / iCloud / Google Drive / OneDrive / USB stash).

It doesn't host the files. It tracks the **metadata + an external link**, so your files stay wherever you already keep them.

## Why it exists

Working LDs accumulate dozens to hundreds of showfiles across many years, many consoles, many clients. The questions that come up:

- *What version of Eos was I on at that church last Easter?*
- *Did I run a backup off the Acme tour rig, or did Sandra?*
- *Where's the file? Dropbox or the silver USB or laptop downloads?*
- *Was that an MA2 show or did we update to MA3 mid-run?*

Filenames and folders don't carry enough metadata. Showfile Tracker does.

## Features

- **Library view** — every showfile, with console badge, last-used date, event count, one-click "open external file".
- **Events** — log each gig the file ran on, with date/venue/role (primary/backup/derived). Auto-updates a `last_used_at` on the showfile for fast sort.
- **Versions** — track named iterations of a file ("v1.0 — opening night", "v1.1 — added rain look") with their own URL if needed.
- **Full-text search** — name, venue, client, notes, tags, rig summary.
- **Filters** — console family (Eos / MA2 / MA3 / Avolites / Hog 4 / ChamSys / Onyx / Other), archived toggle, sort by last-used / name / created / client.
- **CSV import + export** — full data portability. Migration in and out works. The export is a single CSV bundle including events and versions.
- **Dark + light themes** — dark default (consoles live in dark venues), light toggle for the office.
- **Optional auth** — set `AUTH_PASSWORD` to gate, leave it unset for open mode (fork-and-run).
- **Single SQLite file** — `showfiles.db` lives next to the app. Back it up the way you back up everything else.

## Setup

```bash
git clone https://github.com/<you>/showfile-tracker.git
cd showfile-tracker
npm install
npm run build
npm start
```

Open http://localhost:3000 — that's it.

### Development mode

```bash
npm run dev:server   # Express API on :3000
npm run dev          # Vite dev server on :5173, proxies /api
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `AUTH_PASSWORD` | *(unset = open mode)* | Set to gate the app with session + CSRF auth |
| `SESSION_SECRET` | random per boot | HMAC key for session cookies (set persistently if hosting) |
| `SHOWFILES_DB` | `./showfiles.db` | Path to the SQLite file |
| `NODE_ENV` | `production` | Set to `development` to disable secure-cookie flag for local HTTP |

### Open mode vs. gated mode

- **Open mode** (no `AUTH_PASSWORD`): perfect for solo desktop use or behind a Tailscale/VPN. No password.
- **Gated mode** (`AUTH_PASSWORD` set): session cookie + CSRF token. Required if you're putting this on the public internet.

## Console family support

The metadata captured is **console-agnostic**. The console family field exists for organization, filtering, and color coding — not for parsing the file. v1 doesn't read showfile contents.

| Family | Color | Typical formats |
| --- | --- | --- |
| Eos | blue | `.esf` `.esf3` `.show` |
| MA2 | warm red | `.show` |
| MA3 | orange | `.show3` |
| Avolites | magenta | `.lpx` `.avo` |
| Hog 4 | green | `.shw` |
| ChamSys | gold | `.msq` |
| Onyx | purple | `.onyx` |
| Other | grey | — |

## Privacy

Your data is **local**. The default deployment is a single SQLite file on your machine or your own server. There is no cloud, no telemetry, no third-party calls.

If you host this somewhere, your data is wherever you put it. Set `AUTH_PASSWORD` before exposing the URL.

## Data model

```
showfiles
  ├─ showfile_events (linked, recompute last_used_at on insert/update/delete)
  └─ showfile_versions (linked, per-version external URL)
```

The schema auto-migrates on every server boot (idempotent `CREATE TABLE IF NOT EXISTS`). Wipe `showfiles.db` to start clean.

## Backup

```bash
cp showfiles.db backups/showfiles-$(date +%F).db
```

Or use the **Export CSV** button in Settings — one CSV file contains every showfile, event, and version.

## v2 ideas (PRs welcome)

- File uploads (with durable object storage so the open-source story stays clean)
- Showfile parsing (read `.esf` to extract patch / cue counts)
- Apple/Google Calendar sync for events
- Multi-user / sharing
- Print views ("Show binder" PDF per showfile)
- Mobile-native shell

If you want any of these, open an issue or send a PR.

## License

MIT. See [LICENSE](LICENSE).

## Author

Built by **Tanner Harrison** — 12+ years professional LD, NW Lighting.

Built because I needed it and assumed other LDs probably do too. If you find it useful, ⭐ the repo or send a note about how you're using it.

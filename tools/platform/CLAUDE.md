# CLAUDE.md

Claude Code loads this file at the start of every session in this repo.

## The product

**Safety Platform**: a safety and environment management system for factories (ISO 45001, ISO 14001). One copy per factory: its own database (Supabase) and its own site (Cloudflare Pages). The factory owns its data.

- App: `index.html`, one file, no build step. Server: `functions/` (Cloudflare Pages Functions). Settings of a factory: `functions/_site.js`.
- Database: `db/schema.sql` (empty structure), `db/demo-data.sql` (demo site only).
- Setup of a new factory: `SETUP.md`. Agents: `agents/`.

## This repo is the business line

- Every session here: `set_session_title` starting with `עסק: `, and `set_session_tags` with `business`.
- `handoff.md` at the root: what was done, what is next, what waits for the owner. Read it first; update it at the end of every task.
- Answer in Hebrew. Dates for people: DD/MM/YYYY. No long dash.

## Rules

1. No data, names, procedures or documents of any real factory in this repo. Demo data is invented and marked.
2. Money: every expense (domain, ads, service) is the owner's decision. Prepare, compare and recommend; never pay or sign up.
3. Mail or message to a person, deleting anything, publishing anything: only after the owner says "בצע".
4. Hebrew in JS strings: `\uXXXX`. Empty dates: `null`, never `''`. Expiry field: `e`, format YYYY-MM-DD.
5. Changes to the app arrive from the source repo through the export tool. A fix made only here is lost at the next export: note it in `handoff.md` so it goes to the source too.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Grimoire is a family aid/assistant web app (shared calendar, chores, meal planning,
recipes, grocery lists) built from modular features called "Spells," loaded the way
MagicMirror loads modules. See `README.md` for the pitch, `docs/ARCHITECTURE.md` for
system design and rationale, and `docs/ROADMAP.md` for the phased build plan and what's
actually done vs. not yet started.

## Commands

Development happens through Docker Compose — the local shell's Node version may be too
old for this project's tooling (Vite 5, typescript-eslint 8 need Node 18+), so prefer
running things inside the containers over the host.

- Start the stack: `docker compose -f docker/docker-compose.yml up -d --build`
  (server on :3000, web on :5173; drop `--build` once images already exist)
- Restart one service after editing its source: `docker compose -f docker/docker-compose.yml restart server` (or `web`).
  **`tsx watch` does not reliably pick up file changes made from outside the container
  in this environment** (Windows + Docker Desktop bind mount) — always restart the
  `server` container manually after editing anything under `server/`; don't assume hot
  reload caught it.
- Typecheck: `docker compose -f docker/docker-compose.yml exec server npm run typecheck`
  and `... exec web npm run typecheck` (or `npm run typecheck` at repo root if running
  natively with Node 18+)
- Lint: `npm run lint` at repo root, or per-workspace `npm run lint --workspace server` / `--workspace web`
- No test suite exists in either workspace yet — don't invent test commands.
- Tear down: `docker compose -f docker/docker-compose.yml down`

### Docker Desktop path (this machine)

Docker Desktop is installed to a non-default path and isn't on `PATH` automatically:
```
C:\Users\Avry\AppData\Local\Programs\DockerDesktop\resources\bin
```
Add it for the current session before running `docker`/`docker compose` — e.g. in
PowerShell: `$env:PATH += ";C:\Users\Avry\AppData\Local\Programs\DockerDesktop\resources\bin"`.
This does not persist across tool calls or sessions; redo it whenever `docker` isn't found.

### Environment files

- `server/.env` and `docker/.env` hold real secrets and already exist locally
  (both gitignored) — a working Google OAuth client is already configured, so Google
  sign-in can be tested for real without generating new credentials. `ANTHROPIC_API_KEY`
  (for the Recipes Spell's "Generate with AI" feature) is a separate opt-in credential —
  the rest of the app works without it.
- `server/.env.example` and `docker/.env.example` are the committed templates and must
  stay blank placeholders. Real values have accidentally ended up in an `.example` file
  once before — if that happens again, move the values into the real `.env` file and
  restore the template before committing.

## Architecture

Read `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before making structural changes —
they're kept current and explain *why*, not just *what*.

### Spell (module) system

- Every feature is a "Spell": a directory under `server/spells/<name>/` with a
  `spell.json` manifest (`name`, `displayName`, `version`, `backend` entry path,
  `frontend` component name, optional `requires: string[]`, optional `config` defaults)
  and a backend `index.ts` default-exporting `{ register(app, config) }`.
- `server/src/moduleLoader.ts` discovers all Spells, validates that every `requires`
  dependency actually exists (throws a clear error at startup if not), topologically
  sorts so a dependency loads before its dependent, then dynamically imports and
  registers each one. Cross-Spell imports (e.g. the calendar Spell importing
  google-account's client) are ordinary relative TypeScript imports — Spells are
  organizational, not process-isolated.
- The frontend mirrors this: `web/src/spells/registry.tsx` maps a manifest's `frontend`
  field to the React component rendered in the dashboard grid (`App.tsx`);
  `web/src/spells/settings/registry.tsx` maps it to an optional custom Settings-modal
  panel, falling back to the generic key/value editor (`SpellSettingsPanel`) when a
  Spell doesn't register one.
- Settings: `server/src/settingsStore.ts` is a generic key-value store scoped to
  `general` or a Spell's manifest `name`. `GET/PUT /api/settings/:scope` in
  `server/src/index.ts` merges a Spell's manifest `config` (defaults) with saved
  overrides — a Spell's route handlers should read live settings via `getSettings()`
  rather than trusting the `config` object passed to `register()` at startup, since that
  snapshot doesn't reflect later overrides.

### Shared Google sign-in

`server/spells/google-account/` is the only Spell that talks to Google OAuth directly.
It requests every scope a dependent Spell needs (Calendar and Tasks, for the Calendar and
Chores Spells) in one consent screen, and exposes `getAuthorizedClient()` for other Spells to
build their own Google API clients from. The refresh token lives encrypted
(AES-256-GCM, `server/src/secretBox.ts`) in SQLite (`google_account_tokens` table) —
never in a k8s ConfigMap/Secret. Only the static `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
(the app's own OAuth client identity, not any user's) are meant for a Secret once Phase 8
happens. Any Spell needing a Google API declares `"requires": ["google-account"]` in its
manifest.

### Deployment topology

The app (`server` + `web`) is meant to run as a Kubernetes workload on a Proxmox-hosted
Dell server — not on the Raspberry Pi. The Pi (with a touchscreen) is a kiosk client
only, alongside a planned mobile-responsive web view; see the topology diagram in
`docs/ARCHITECTURE.md`. This is why the CSS layout (`.grimoire-grid`, an auto-fit grid)
is built to serve kiosk, mobile, and desktop viewports from the same code rather than
assuming Pi-class resource constraints on the server side.

## Maintaining documentation

Docs here are load-bearing, not incidental cleanup — update them as part of finishing a
change, not afterward:
- `docs/ROADMAP.md`: update a phase's status marker and bullets when part of it actually ships.
- `docs/ARCHITECTURE.md`: update when a structural decision changes (a new cross-cutting
  system, a changed data flow, a revised deployment plan).
- `docs/setup/*.md`: update when a setup step changes (new env var, new API scope, new
  external service).
- This file: update the Commands/Architecture notes above when they change — it's the
  first thing loaded into every future session in this repo.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Grimoire is a family aid/assistant web app (shared calendar, chores, meal planning,
recipes, grocery lists) built from modular features called "Spells," loaded the way
MagicMirror loads modules. See `README.md` for the pitch, `docs/ARCHITECTURE.md` for
system design and rationale, and `docs/ROADMAP.md` for the phased build plan and what's
actually done vs. not yet started.

## Git workflow

`dev` is the integration branch for all day-to-day work, and is the GitHub repo's
default branch — `main` is kept as a stable snapshot, updated by merging `dev` into it
periodically rather than on every change. This split exists so testing never has to
wait on a `main` update: the Docker dev stack bind-mounts this checkout's working
directory directly, so **this checkout should stay checked out on `dev`** — restarting
`server`/`web` (see Commands below) always reflects whatever's latest on `dev`.

Feature work still happens in isolated git worktrees (one per task, branched off
`dev`), same as before — it's merging and PR targets that changed, not the isolation
itself. When a worktree's change is ready: merge it into local `dev` in this checkout
(`git merge <branch>`), push `dev`, then restart the affected container(s) so the
running dev stack picks it up immediately. Open PRs with `gh pr create --base dev`
(the repo's default branch is `dev`, so a plain `gh pr create` already targets it).
Only merge `dev` into `main` deliberately, when `dev` represents a good stable point —
don't do this automatically as part of routine feature work.

## Commands

Development happens through Docker Compose — the local shell's Node version may be too
old for this project's tooling (Vite 5, typescript-eslint 8 need Node 18+), so prefer
running things inside the containers over the host.

- Start the stack: `docker compose -f docker/docker-compose.yml up -d --build`
  (server on :3000, web on :5173, plus a bundled Home Assistant instance on :8123 that
  backs the Smart Home Spell — see `docs/setup/smart-home.md`; drop `--build` once
  images already exist)
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
  field to the React component rendered full-screen when that Spell is opened from the
  side dock (`web/src/components/SpellDetailView.tsx`); `web/src/spells/settings/
  registry.tsx` maps it to an optional custom Settings-modal panel, falling back to the
  generic key/value editor (`SpellSettingsPanel`) when a Spell doesn't register one. A
  third, optional registry, `web/src/spells/homeWidgets/registry.tsx`, maps it to the
  compact "glance" widget size variants a Spell can offer on the home dashboard grid —
  see "Home dashboard" in `docs/ARCHITECTURE.md`.
- Settings: `server/src/settingsStore.ts` is a generic key-value store scoped to
  `general`, a Spell's manifest `name`, or any other scope string (e.g. `layout`, the
  home dashboard's saved widget positions — no matching Spell manifest needed).
  `GET/PUT /api/settings/:scope` in `server/src/index.ts` merges a Spell's manifest
  `config` (defaults) with saved overrides — a Spell's route handlers should read live
  settings via `getSettings()` rather than trusting the `config` object passed to
  `register()` at startup, since that snapshot doesn't reflect later overrides.

### Shared Google sign-in

`server/spells/google-account/` is the only Spell that talks to Google OAuth directly.
It requests every scope a dependent Spell needs (Calendar and Tasks, for the Calendar and
Chores Spells) in one consent screen, and exposes `getAuthorizedClient()` for other Spells to
build their own Google API clients from. The refresh token lives encrypted
(AES-256-GCM, `server/src/secretBox.ts`) in SQLite (`google_account_tokens` table) —
never in a container env file or Compose config. Only the static
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (the app's own OAuth client identity, not any
user's) are meant to live in the prod `.env` once Phase 8 happens. Any Spell needing a Google API declares `"requires": ["google-account"]` in its
manifest.

### Deployment topology

The app (`server` + `web`) is meant to run via Docker Compose inside an unprivileged LXC
container on a Proxmox-hosted Dell server — not on the Raspberry Pi, and not a
Kubernetes cluster (overkill for a single-family, single-node app). The LXC needs
nesting enabled (`features: nesting=1,keyctl=1`) so Docker can run inside it. The Pi
(with a touchscreen) is a kiosk client only, alongside a planned mobile-responsive web
view; see the topology diagram in `docs/ARCHITECTURE.md`. This is why the home
dashboard's widget grid
(`web/src/homeGrid/`) is built to fit one screen with no scrolling and its drag
interaction is Pointer Events–based (touch-capable), rather than assuming desktop-mouse
input or Pi-class resource constraints on the server side.

### Frontend conventions

See `docs/ARCHITECTURE.md` → "Frontend conventions" (plus its "Theming" and "Home
dashboard" subsections) before building a new Spell's UI. House rules that apply across
Spells, not just the ones that introduced them: action buttons always live in a
non-scrolling row at the top of their page/modal/panel (never CSS-scrollable out of
reach); cross-Spell *semantic* drag-and-drop (dragging one Spell's item onto another
Spell's drop target) uses a small shared `dataTransfer` MIME-key module — HTML5 DnD, see
`web/src/spells/recipeDrag.ts` — while the home dashboard's *widget-repositioning* drag
is a deliberately different, Pointer Events–based mechanism
(`web/src/homeGrid/dragEngine.ts`), since HTML5 DnD has no reliable touch support and
touch is the primary input on the kiosk this app targets; and dark is the default theme,
applied via a `data-theme` attribute + CSS custom-property tokens rather than relying on
`prefers-color-scheme` alone (see "Theming" in `docs/ARCHITECTURE.md`).

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

# Grimoire

**v1.0** — a family aid/assistant web app: shared calendar, chores, meal planning,
recipes, grocery lists (with Fred Meyer/Kroger cart export), voice/text commands, and
smart-home device control, presented as a themed, no-scroll home dashboard of
drag-to-arrange widgets. Built from modular features ("Spells") that plug into the core
app like MagicMirror modules — see `docs/ROADMAP.md` for the full feature-by-feature
build history and what's still ahead.

- **Server**: runs via Docker Compose (`server` + `web` + a bundled Home Assistant
  instance for the Smart Home Spell); prod target is a Proxmox LXC container on a Dell
  server
- **Clients today**: the Chromium kiosk touchscreen and any desktop/tablet browser on the
  LAN. A dedicated mobile-responsive layout (phones, PWA install) is planned next —
  see `docs/ROADMAP.md` Phase 9 — the app is usable but not yet optimized on a phone
  screen.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system design and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the phased build plan.

## Development

Requires Docker Desktop.

```
docker compose -f docker/docker-compose.yml up --build
```

- Web (start here): http://localhost:5173
- Server API: http://localhost:3000
- Home Assistant (backs the Smart Home Spell): http://localhost:8123 — see
  `docs/setup/smart-home.md` for first-run setup
- `docs/setup/*.md` also covers Google sign-in and Fred Meyer/Kroger, the other two
  external integrations that need one-time setup before their Spells work

## Structure

```
server/         Node/TypeScript API + Spell (module) loader
  spells/       One directory per Spell (calendar, chores, recipes, meal-plan,
                grocery-list, retail-kroger, google-account, voice-commands, smart-home,
                weather)
web/            React + TypeScript frontend
  src/spells/       Full-screen + home-dashboard "glance" widget per Spell
  src/homeGrid/     The home dashboard's widget-grid engine (layout, drag, resize)
  src/appState/     Theme + view-state React Context providers
  src/components/   App shell: header, side dock, settings modal, spell detail view
docker/         Dockerfiles + docker-compose.yml (also promoted to the Proxmox LXC in prod)
docs/           Roadmap, architecture, decisions, per-integration setup guides
```

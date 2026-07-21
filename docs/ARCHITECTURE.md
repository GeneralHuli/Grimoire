# Grimoire Architecture

## Topology

```
                        ┌─────────────────────────────┐
                        │  Proxmox host (Dell server)  │
                        │  ┌────────────────────────┐  │
                        │  │  Kubernetes cluster      │  │
                        │  │  - grimoire-server (API) │  │
                        │  │  - grimoire-web (static) │  │
                        │  │  - SQLite on PVC         │  │
                        │  └────────────────────────┘  │
                        └───────────────┬──────────────┘
                                        │ LAN (ingress)
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
      ┌───────▼────────┐       ┌────────▼────────┐       ┌────────▼────────┐
      │ Raspberry Pi 3B │       │  Phones/Tablets  │       │  Laptops/other   │
      │ + touchscreen   │       │  (mobile PWA)    │       │  (browser)       │
      │ Chromium kiosk  │       │                  │       │                  │
      └────────────────┘       └──────────────────┘       └──────────────────┘
```

The Pi never runs the application — it's a thin client pointed at the server's LAN
address in kiosk mode. This means the server-side architecture is designed for the
Proxmox host's resources, not the Pi's, while the frontend is designed to be responsive
across kiosk, mobile, and desktop viewports from day one.

## Repo layout

```
Grimoire/
  server/            Node/TypeScript API (Express/Fastify)
    src/
      moduleLoader.ts   Scans spells/, loads manifests, registers routes
      index.ts          App entrypoint
    spells/             Each subfolder is a Spell: spell.json + backend code
  web/               React + TypeScript frontend (Vite)
    src/
      spells/           Frontend widget per Spell, dynamically rendered by manifest
  docker/            Dockerfiles + docker-compose.yml for local dev
  k8s/               Deployment manifests for the Proxmox cluster (Phase 8)
  docs/              Roadmap, architecture, decisions
```

## Spell architecture (module system)

Modeled on MagicMirror: a Spell is a self-contained directory with a manifest describing
what it provides, so the core app never hardcodes feature-specific logic.

`spells/<name>/spell.json`:
```json
{
  "name": "calendar",
  "displayName": "Family Calendar",
  "version": "0.1.0",
  "backend": "./index.ts",
  "frontend": "calendar",
  "config": {
    "position": "top-left"
  }
}
```

- **Backend**: `moduleLoader.ts` walks `spells/`, imports each manifest's `backend` entry,
  and calls a standard `register(app, config)` export to mount routes under
  `/api/spells/<name>/...`.
- **Frontend**: the web app fetches the list of enabled spells + their `config` from the
  server on boot, and dynamically renders the matching component from `web/src/spells/`.
  Layout position/size comes from config, not code, so rearranging the kiosk grid doesn't
  require a redeploy.
- Each Spell owns its own DB tables/migrations — the core app only owns the spell
  registry table.

## Data storage

SQLite (via `better-sqlite3`), single file on a PVC in Phase 8. Fits the "lightweight
database" requirement and needs no separate DB server. If a Spell's access patterns
outgrow SQLite later (e.g. heavy concurrent writes), that Spell can swap its own storage
without affecting others, since each Spell owns its own tables.

## External integrations and open risks

| Integration | Status | Notes |
|---|---|---|
| Google Calendar | Straightforward | Standard OAuth2 + Calendar API |
| Google Tasks | Straightforward | Standard OAuth2 + Tasks API |
| Recipe URL import | Straightforward | Parse `schema.org/Recipe` JSON-LD, present on most recipe sites |
| AI recipe generation | Straightforward | Single structured-output API call |
| Fred Meyer / Kroger | Likely feasible | Kroger family has a public developer API (product search + cart) |
| Albertsons | **Research spike needed** | No known public API as of 2026; may need a partner application, or may end up manual-export only |
| Google Assistant / Home | **Research spike needed** | Conversational Actions (the old voice-command platform) shut down in 2023. Current path is likely the Local Home SDK (device control, not general voice Q&A) or a self-hosted bridge (e.g. Home Assistant's conversation integration). Scope this properly before committing Phase 7 engineering time. |

Both spikes are called out explicitly in the roadmap (Phase 6 and Phase 7) so they happen
before implementation work, not mid-phase.

## Deployment environments

- **Dev**: Docker Compose on the dev machine (Docker Desktop), hot-reload for server + web
- **Prod**: Kubernetes on the Proxmox-hosted Dell server (Phase 8), same container images
  built for dev, promoted via CI

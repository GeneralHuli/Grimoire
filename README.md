# Grimoire

A family aid/assistant web app: shared calendar, chores, meal planning, recipes, and
grocery lists, built from modular features ("Spells") that plug into the core app like
MagicMirror modules.

- **Server**: runs on a Kubernetes cluster on a Proxmox-hosted Dell server
- **Clients**: a Raspberry Pi 3B + touchscreen running Chromium in kiosk mode, plus a
  mobile-friendly responsive web app for phones/tablets

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system design and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the phased build plan.

## Development

Requires Docker Desktop.

```
docker compose -f docker/docker-compose.yml up --build
```

- Server: http://localhost:3000
- Web: http://localhost:5173

## Structure

```
server/   Node/TypeScript API + Spell (module) loader
web/      React + TypeScript frontend
spells    Modules live in server/spells, one directory per Spell
docker/   Dev Dockerfiles + docker-compose.yml
k8s/      Kubernetes manifests for the Proxmox cluster (Phase 8+)
docs/     Roadmap, architecture, decisions
```

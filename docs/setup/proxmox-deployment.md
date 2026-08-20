# Proxmox LXC deployment

Prod deployment target is an unprivileged **LXC container** on the Proxmox-hosted Dell
server (Phase 8 in `docs/ROADMAP.md`) — not a Kubernetes cluster, and not a purpose-built
production image. The LXC runs Docker + Docker Compose internally and promotes the exact
same `docker/docker-compose.yml` and Dockerfiles already used in dev, just against real
secrets and a persistent volume, so there's no separate deployment manifest to maintain.

## 1. Create the LXC container

In the Proxmox web UI (or `pct create` on the host):
- **Template**: Debian 12 or Ubuntu 22.04/24.04 — either works fine with Docker
- **Unprivileged container**: yes
- **Resources**: 2 vCPU / 2–4 GB RAM / 16+ GB disk is plenty (Node + SQLite + Home
  Assistant)
- **Network**: bridged to the LAN, static IP or a DHCP reservation — family devices need
  a stable address to point at

## 2. Enable nesting

Proxmox disables this by default, and Docker won't start inside the container without
it. Either:
- GUI: select the container → **Options** → **Features** → check **Nesting** and
  **keyctl**
- CLI on the Proxmox host: `pct set <vmid> --features nesting=1,keyctl=1`

## 3. Install Docker inside the container

`pct enter <vmid>` (or SSH in once it's up), then the standard install script:
```bash
curl -fsSL https://get.docker.com | sh
```
This installs Docker Engine + the Compose plugin (`docker compose`) — no separate
Compose install needed.

## 4. Clone the repo

```bash
git clone https://github.com/GeneralHuli/Grimoire.git
cd Grimoire
```

## 5. Set up production secrets

```bash
cp server/.env.example server/.env
cp docker/.env.example docker/.env
```
- `GRIMOIRE_ENCRYPTION_KEY`: generate a fresh one — `openssl rand -hex 32`. This is a new
  deployment, so there's no existing encrypted data to preserve continuity with.
- `GOOGLE_CLIENT_ID`/`SECRET`, `KROGER_CLIENT_ID`/`SECRET`, `ANTHROPIC_API_KEY`: same
  values as dev — these identify the Grimoire app itself, not a user session.
- `GOOGLE_REDIRECT_URI` and `KROGER_REDIRECT_URI`: change the host from `localhost` to
  the LXC's real LAN address (e.g. `http://192.168.1.50:3000/...` and
  `http://192.168.1.50:5173/...`). Also **add** these as additional redirect URIs in the
  Google Cloud Console and Kroger's app registration — don't replace the dev ones; both
  Google and Kroger allow more than one registered redirect URI per app. See
  `docs/setup/google-account.md` and `docs/setup/kroger.md`.

## 6. Bring up the stack

```bash
docker compose -f docker/docker-compose.yml up -d --build
```
This starts `server` (:3000), `web` (:5173), and `home-assistant` (:8123) — the same
three services as dev, since the compose file bind-mounts the repo checkout itself
rather than baking a separate prod image. Once it's up, run through
`docs/setup/google-account.md`, `docs/setup/kroger.md`, and `docs/setup/smart-home.md`
again against the new LAN address — these are per-deployment one-time consent/token
flows, not something that carries over from a dev instance.

## 7. Point family devices at it

Any browser on the LAN hits `http://<lxc-ip>:5173` — the Pi kiosk, phones, laptops.
No ingress or reverse proxy is required for this to work; that's only worth adding later
for TLS or a friendly hostname instead of an IP:port.

## Known limitation

`docker/server.Dockerfile` and `web.Dockerfile` run `npm run dev` (tsx watch / Vite dev
server) — the same as dev, since this plan promotes the existing dev images rather than
building dedicated production bundles. It works fine for a single-family LAN app, just
not as lean as a real `npm run build` + static-serve setup would be. A production-build
Dockerfile pass is a reasonable future improvement, not a blocker for this deployment.

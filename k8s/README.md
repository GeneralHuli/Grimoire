# Kubernetes manifests (Phase 8)

Placeholder — manifests for deploying `server` and `web` to the Proxmox-hosted k8s
cluster land here once Phase 8 starts. Expected pieces, per `docs/ARCHITECTURE.md`:

- `Deployment` + `Service` for `grimoire-server` and `grimoire-web`
- `PersistentVolumeClaim` for the SQLite data file (this is where the encrypted Google
  refresh token and other per-account secrets actually live — see
  `docs/ARCHITECTURE.md` > "Shared Google sign-in")
- `ConfigMap` for non-secret Spell config
- `Secret` for static app-level credentials only: OAuth *client* IDs/secrets
  (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, future retail API keys), plus
  `GRIMOIRE_ENCRYPTION_KEY`. Never a user's OAuth token — those are obtained
  interactively and stored encrypted in SQLite, not injected at deploy time.
- `Ingress` for LAN access from the Pi kiosk, phones, and other devices

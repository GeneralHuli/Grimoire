# Kubernetes manifests (Phase 8)

Placeholder — manifests for deploying `server` and `web` to the Proxmox-hosted k8s
cluster land here once Phase 8 starts. Expected pieces, per `docs/ARCHITECTURE.md`:

- `Deployment` + `Service` for `grimoire-server` and `grimoire-web`
- `PersistentVolumeClaim` for the SQLite data file
- `ConfigMap` for non-secret Spell config
- `Secret` for OAuth tokens / API keys (Google, Kroger, etc.)
- `Ingress` for LAN access from the Pi kiosk, phones, and other devices

# Smart Home setup

The **Smart Home Spell** (`smart-home`) doesn't talk to any device brand's API directly —
it's a thin authenticated REST client against a self-hosted **Home Assistant** instance,
which does the actual device integration (2,700+ brands, including Nest). No OAuth client
registration is needed, unlike every other external integration in this repo.

1. Run Home Assistant. Dev already has this covered: `docker/docker-compose.yml` defines
   a `home-assistant` service (`ghcr.io/home-assistant/home-assistant`) alongside
   `server`/`web`, exposed on `:8123`. In prod (Phase 8) it runs the same way, just
   promoted into the LXC's compose stack with the rest.
2. Open `http://localhost:8123` and complete Home Assistant's own first-run setup (admin
   account, timezone, location). This is entirely inside Home Assistant's UI — no
   Grimoire code involved.
3. Add whatever integrations cover your real devices (Settings → Devices & Services in
   Home Assistant) — Nest, Hue, Kasa, etc. For dev/testing without real hardware, enable
   the built-in **Demo** integration instead (`demo:` in `configuration.yaml`), which is
   what this Spell was verified end-to-end against.
4. In Home Assistant, go to your profile page (bottom-left) → **Security** tab → **Long-
   lived access tokens** → **Create Token**. Copy it immediately — Home Assistant only
   shows it once.
5. In Grimoire's Settings → Smart Home tab, enter the Home Assistant URL (e.g.
   `http://localhost:8123` in dev) and paste the token, then Save. Grimoire stores the
   token encrypted in SQLite (`smart_home_connection` table, same `secretBox.ts` scheme
   as the Google refresh token) — it never reaches the browser after that; the server
   proxies every Home Assistant request (including camera snapshots/live-view) on the
   token's behalf.

**Known limits**: real device pairing and real camera streaming aren't verified yet in
dev, since this dev Home Assistant instance runs under Docker Desktop/WSL2 on Windows and
can't reach the actual home LAN (mDNS/SSDP auto-discovery needs `network_mode: host`,
which behaves differently there than on a native Linux host) — see `docs/ROADMAP.md`
Phase 7 Part 2 for detail. This becomes testable once Home Assistant runs somewhere with
real LAN access, most naturally the eventual Proxmox deployment (Phase 8).

**Optional add-on**: to have Home Assistant send commands *to* Google Assistant (casting,
broadcast announcements, spoken-answer playback) rather than just being controlled by
Grimoire, see `docs/setup/google-assistant-sdk.md` — a separate, optional integration
configured entirely inside Home Assistant.

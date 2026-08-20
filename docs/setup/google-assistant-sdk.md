# Google Assistant SDK setup (Home Assistant)

This isn't a Grimoire Spell — it's a **Home Assistant integration**
(`google_assistant_sdk`), configured entirely inside the `home-assistant` container
Grimoire's Docker Compose stack now runs (see Phase 7 Part 2 in `docs/ROADMAP.md`). It
lets Home Assistant send commands *to* Google Assistant — casting to a Chromecast,
broadcasting an announcement to Google speakers/displays, or playing back Assistant's
spoken answers — the opposite direction from the `google_assistant` integration (which
would expose Home Assistant's own devices *to* Google Home for "Hey Google" voice
control; not what this doc covers).

Reuses the **same Google Cloud project** as `google-account`'s `GOOGLE_CLIENT_ID` (no
need to start a fresh project), but needs its **own new OAuth Client ID** within that
project — the Assistant SDK's scope and required redirect URI don't match the one
`google-account` already uses for its own callback route.

1. In that same [Google Cloud Console](https://console.cloud.google.com/) project,
   **APIs & Services > Library** — enable the **Google Assistant API**
   (`embeddedassistant.googleapis.com`).
2. **APIs & Services > OAuth consent screen** — if not already External (it should be,
   from the `google-account` setup), no changes needed there.
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://my.home-assistant.io/redirect/oauth` — this is
     Home Assistant's own hosted OAuth redirect helper, not a Grimoire/local URL; use it
     exactly as written regardless of where this instance runs.
   - **Copy the Client ID and Client Secret immediately** — Google will not show the
     secret again once this dialog is closed.
4. **Publish the app** (OAuth consent screen > Publish app) rather than leaving it in
   Testing. Home Assistant's own docs are explicit that an unpublished/Testing-mode app's
   token expires every 7 days for this particular scope — unlike `google-account`'s
   Calendar/Tasks scopes, which are fine to leave in Testing indefinitely. Publishing may
   prompt Google's own verification flow depending on how it classifies this scope's
   sensitivity; if that's more friction than it's worth, staying in Testing and just
   reconnecting the integration weekly is a workable fallback for personal use.
5. In Home Assistant itself: **Settings > Devices & Services > Add Integration >
   "Google Assistant SDK"**. Paste the Client ID/Secret from step 3 when prompted, then
   complete the Google consent flow it walks you through (this is a live browser flow
   with your own Google account — nothing here can be scripted/automated). No
   `configuration.yaml` editing needed; it's entirely UI-driven.

**Skip unless you specifically want it**: the integration's "Desktop app credential" for
personal results (e.g. "remind me tomorrow at 9pm to take out the trash") needs a
*second*, separate OAuth client (Desktop app type), running a local Python script
(`google-oauthlib-tool`) by hand, and manually editing Home Assistant's internal storage
files — meaningfully more fragile and manual than the base setup above. Home Assistant's
own docs call this "advanced users only."

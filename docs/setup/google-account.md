# Google Account setup

The **Google Account Spell** is a shared, standalone Spell that owns the family's single
Google sign-in — every other Spell that needs a Google API (Calendar today, Tasks in
Phase 2, more later) declares `"requires": ["google-account"]` in its manifest and reuses
this one connection instead of running its own OAuth flow. Sign in once, from the Google
Account tab in Settings (or its dashboard card), and every dependent Spell picks it up.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project
   (or reuse one).
2. **APIs & Services > Library** — enable both the "Google Calendar API" and "Google
   Tasks API" (enable more here as future Spells need them).
3. **APIs & Services > OAuth consent screen** — set up an external consent screen (Testing
   mode is fine for a single-family app; add your Google account under Test users).
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/spells/google-account/auth/callback`
     (match `GOOGLE_REDIRECT_URI` — update both if the server runs somewhere other than
     `localhost:3000`, e.g. once it's behind the Proxmox cluster's ingress)
5. Copy the generated **Client ID** and **Client secret** into `server/.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). These identify the Grimoire app itself,
   not any one user — they're the only Google-related values safe to store as a static
   k8s Secret (Phase 8). The resulting refresh token is a different matter: it's obtained
   through the sign-in flow below and stored encrypted in SQLite, never in a
   ConfigMap/Secret.
6. Generate `GRIMOIRE_ENCRYPTION_KEY`: `openssl rand -hex 32`.
7. Start the server, then visit `/api/spells/google-account/auth/start` in a browser (or
   click "Sign in with Google" on the Google Account card/settings tab) — it redirects to
   Google's consent screen requesting Calendar + Tasks scopes together, then back to the
   callback, which stores an encrypted refresh token in SQLite. After that,
   `/api/spells/google-account/status` should report `connected: true`, and Calendar
   (and later Chores) start working immediately with no separate sign-in.

If Google doesn't return a refresh token on connect (it only does so the *first* time an
account grants access, or after access is revoked), remove Grimoire's access at
https://myaccount.google.com/permissions and try connecting again.

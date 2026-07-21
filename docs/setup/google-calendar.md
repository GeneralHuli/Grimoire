# Google Calendar setup

The Calendar Spell needs an OAuth client so it can read/write the family Google Calendar.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project
   (or reuse one).
2. **APIs & Services > Library** — enable the "Google Calendar API".
3. **APIs & Services > OAuth consent screen** — set up an external consent screen (Testing
   mode is fine for a single-family app; add your Google account under Test users).
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/spells/calendar/auth/callback`
     (match `GOOGLE_REDIRECT_URI` — update both if the server runs somewhere other than
     `localhost:3000`, e.g. once it's behind the Proxmox cluster's ingress)
5. Copy the generated **Client ID** and **Client secret** into `server/.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
6. Generate `GRIMOIRE_ENCRYPTION_KEY`: `openssl rand -hex 32`.
7. Start the server, then visit `/api/spells/calendar/auth/start` in a browser — it
   redirects to Google's consent screen, then back to the callback, which stores an
   encrypted refresh token in SQLite. After that, `/api/spells/calendar/status` should
   report `connected: true`.

If Google doesn't return a refresh token on connect (it only does so the *first* time an
account grants access, or after access is revoked), remove Grimoire's access at
https://myaccount.google.com/permissions and try connecting again.

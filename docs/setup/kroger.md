# Fred Meyer / Kroger setup

The **Fred Meyer / Kroger Spell** (`retail-kroger`) connects one Kroger-family shopper
account (Fred Meyer is a Kroger banner) so items from the Grocery List can be sent to
that shopper's real online cart. Unlike `google-account`, this isn't a shared Ritual
other Spells depend on — it's used directly from the Grocery List Spell's "Send to Fred
Meyer" action.

1. Go to [developer.kroger.com](https://developer.kroger.com/), create a free account
   (email verification required), then register an application.
   - Redirect URI: `http://localhost:5173/api/spells/retail-kroger/auth/callback` — note
     the port is **5173** (the Vite dev server the browser is actually pointed at), not
     3000 (the bare API server). Vite's dev proxy forwards `/api/*` — this callback
     included — through to the server on :3000 automatically, so registering :3000
     directly here leaves the browser stranded on a bare API origin with no frontend
     route once Kroger redirects back, which looks like a stuck/spinning "won't connect"
     failure rather than a clean error. Update both this and `KROGER_REDIRECT_URI` if the
     server runs somewhere other than `localhost:5173`, e.g. once it's behind the Proxmox
     cluster's ingress in Phase 8; Kroger lets an app register more than one redirect
     URI, so add the production one alongside this dev one rather than replacing it.
   - No partner/business approval step exists for the Public API tier — registration is
     immediate.
2. Copy the generated **Client ID** and **Client secret** into `server/.env`
   (`KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`). Like the Google credentials, these
   identify the Grimoire app itself, not any one shopper — the only Kroger-related
   values safe to store as a static k8s Secret (Phase 8). The shopper's own cart access
   is a separate matter, covered below.
3. Start the server, then visit `/api/spells/retail-kroger/auth/start` (or click
   "Connect Fred Meyer Account" in the Fred Meyer / Kroger settings tab) — it redirects
   to Kroger's consent screen requesting the `cart.basic:write` scope, then back to the
   callback, which stores an encrypted access + refresh token pair in SQLite. After
   that, `/api/spells/retail-kroger/status` should report `connected: true`.
4. In the same settings tab, search for a store by zip code and pick one — the Product
   API needs a `locationId` for pricing/availability, so this has to be set once before
   product search works. This uses a separate app-level (client_credentials) token, not
   the shopper's own sign-in.

**Known limits** (see `docs/ARCHITECTURE.md` → "External integrations and open risks"
for the full spike writeup): the Cart API only adds items to a cart — there's no
checkout/order-placement endpoint, so the shopper always finishes checkout themselves in
the Kroger/Fred Meyer app or site. Rate limits are generous for a single-family app
(~10,000 calls/day for products, ~5,000/day for cart) but not unlimited.

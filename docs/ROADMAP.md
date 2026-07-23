# Grimoire Roadmap

Grimoire is a family aid/assistant web app built from modular features ("Spells") loaded
like MagicMirror modules. The app itself runs as a Kubernetes workload on a Dell server
(Proxmox host); a Raspberry Pi 3B with a touchscreen is one client endpoint (kiosk mode),
alongside a mobile-friendly responsive view for phones/tablets.

Phases are sequential but each is scoped to ship something usable on its own.

## Phase 0 — Foundations — **Done**
- Monorepo scaffold: `server` (Node/TypeScript API) + `web` (React touchscreen UI)
- Spell loader: scans a `spells/` directory, reads each `spell.json` manifest, registers
  backend routes + frontend widgets dynamically; validates a manifest's `requires` list
  and topologically orders loading so a dependency always loads before its dependent
- Settings modal (side tabs: General + one per loaded Spell). Generic key/value editor
  is the default per-Spell tab; a Spell can register a custom panel instead
- SQLite as the lightweight datastore (via `better-sqlite3`)
- Docker Compose dev environment
- CI: lint + typecheck on push (no test suite exists yet — see "Commands" in
  `/CLAUDE.md`, nothing to run yet)

## Phase 1 — Calendar Spell + shared Google sign-in — **Done**
- Standalone `google-account` Spell: one "Sign in with Google" flow requesting every
  scope a dependent Spell needs (Calendar now, Tasks below) in a single consent screen;
  refresh token stored encrypted at rest, never in a ConfigMap/Secret
- Calendar Spell declares `requires: ["google-account"]` and reuses that connection —
  no separate OAuth flow of its own
- Read/write against Google Calendar API; user can pick which of the account's calendars
  to display (`GET /api/spells/calendar/calendars` + a saved `calendarId` setting)
- Touchscreen-first calendar view (month/week/day, month is the default), kiosk-safe:
  tapping a day in Month/Week opens that day's view, tapping an event opens an edit modal

## Phase 2 — Chores Spell — **Done**
- Google Tasks API integration: each selected Google Task list is shown as a
  family-member board (`GET /api/spells/chores/tasklists` + a saved `listIds` setting)
- Declares `requires: ["google-account"]` — reuses the Phase 1 sign-in (Tasks scope is
  already requested by the shared Google Account Spell), no new consent screen needed
- Simple assignment/check-off UI sized for touch: tap a checkbox to complete/reopen a
  chore, add new chores inline per board

## Phase 3 — Recipes Spell — **Done**
- Manual recipe entry (ingredients, steps, meal type, prep-ease, star rating) — a card grid
  with a create/edit/delete modal per recipe
- URL import: parses `schema.org/Recipe` JSON-LD out of the page's `<script
  type="application/ld+json">` blocks (covers most recipe sites without an HTML-scraping
  library), returning an editable draft rather than saving directly
- AI-generated recipes via the Claude API (`claude-opus-4-8`, structured JSON output),
  same draft-then-review flow as URL import — requires `ANTHROPIC_API_KEY` in
  `server/.env`; the rest of the Spell works without it
- SQLite schema: `recipes` (title, meal type, ease, rating, source URL) plus
  `recipe_ingredients` / `recipe_steps` as ordered line tables per recipe

## Phase 4 — Meal Planner Spell — **Done**
- Weekly meal plan grid (Sun–Sat, prev/today/next navigation like the Calendar Spell),
  one recipe per day, keyed by date so past/future weeks are independently editable
- Two ways to assign a recipe to a day: native HTML5 drag-and-drop from the recipe chip
  list, or tap a recipe then tap a day (touch-friendly fallback where drag gestures are
  unreliable)
- Declares `requires: ["recipes"]` — reads the Recipes Spell's `recipes` table directly
  via a SQL join (`meal_plan_entries.recipe_id` → `recipes.id`); a deleted recipe's plan
  entries simply drop out of the view rather than dangling
- Frontend fetches the recipe list straight from the Recipes Spell's existing
  `GET /api/spells/recipes/recipes` endpoint — no duplicated recipe list on the backend

## Phase 5 — Grocery List Spell — **Not started**
- Auto-aggregate ingredients from the active meal plan
- Manual add/remove, quantity merge (dedupe "2 onions" + "1 onion")
- Depends on: Meal Planner Spell

## Phase 6 — Retail Integration — **Not started**
- **Research spike first** (see Architecture doc, Risks): confirm current API access for
  Fred Meyer (Kroger family — has a public developer API) and Albertsons (no known public
  API as of 2026; may require partner application or may be a stretch/manual-export goal)
- Kroger/Fred Meyer: OAuth + cart API, export grocery list → cart
- Albertsons: scoped down or descoped based on spike findings
- Depends on: Grocery List Spell

## Phase 7 — Google Assistant / Home Integration — **Not started**
- **Research spike first**: Google's Conversational Actions (the old Actions on Google
  voice-command platform) were shut down in 2023. Current options are the Local Home SDK
  (device control only, not general Q&A) or routing via a self-hosted intermediary
  (e.g. Home Assistant conversation integration). This phase's design depends entirely on
  spike findings — flag to Avry before committing engineering time here.
- Goal: "Hey Google, ask [device name] to add milk to the list" style commands routed to
  the relevant Spell's action handler

## Phase 8 — Kubernetes Deployment (Proxmox / Dell server) — **Not started**
- Cluster target is the Dell server under Proxmox, not the Pi — the Pi is a client only,
  so no on-device resource constraints drive the manifest design
- Move from Docker Compose (dev) to the k8s cluster (k3s/k0s or full k8s — TBD based on
  what's already running on the Proxmox host)
- Manifests: Deployment, Service, PVC (SQLite file persistence — this is where the
  encrypted Google refresh token lives), ConfigMap, Secrets (OAuth *client*
  IDs/secrets and other static API keys only — never a user's OAuth token)
- Ingress for LAN access from family devices (Pi, phones, laptops)

## Phase 9 — Mobile-Friendly Web App — **Not started**
- Responsive layout pass so every Spell's UI works on phone/tablet viewports, not just
  the touchscreen kiosk's fixed resolution
- Likely a PWA (installable, works offline for read-mostly views like the meal plan)
- Depends on: core Spells from Phases 1-5 having stable UIs to make responsive

## Phase 10 — Kiosk Polish (Raspberry Pi client) — **Not started**
- Chromium kiosk mode on the Pi touchscreen, pointed at the Grimoire server on the LAN
- Module layout configuration (MagicMirror-style: position modules in a grid via config,
  no code changes needed) — shared with the mobile view where it makes sense
- Theming pass

## Backlog / later ideas
- Additional Spells as they come up (explicitly expected — the module architecture exists
  so new Spells don't require touching the core app)
- Multi-user profiles / permissions per family member
- Notifications (push to phones when chores assigned, groceries low, etc.)

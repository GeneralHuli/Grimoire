# Grimoire Roadmap

Grimoire is a family aid/assistant web app built from modular features ("Spells") loaded
like MagicMirror modules. The app itself runs as a Docker Compose stack inside a Proxmox
LXC container on a Dell server; a Raspberry Pi 3B with a touchscreen is one client
endpoint (kiosk mode), alongside a mobile-friendly responsive view for phones/tablets.

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
  refresh token stored encrypted at rest, never in a container env file or Compose config
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
  with a create/edit/delete modal per recipe, plus a larger read-only view (bulleted,
  independently-scrolling ingredients/steps columns) opened by tapping a recipe
- URL import: parses `schema.org/Recipe` JSON-LD out of the page's `<script
  type="application/ld+json">` blocks (covers most recipe sites without an HTML-scraping
  library), returning an editable draft rather than saving directly; decodes HTML
  entities and collapses whitespace so imported ingredient/step text is usable as-is
- AI-generated recipes via the Claude API (`claude-opus-4-8`, structured JSON output),
  same draft-then-review flow as URL import — requires `ANTHROPIC_API_KEY` in
  `server/.env`; the rest of the Spell works without it
- Search filter (title / meal type) in the recipe list toolbar; recipe cards are also
  the drag source for the Meal Planner Spell (see Phase 4)
- SQLite schema: `recipes` (title, meal type, ease, rating, source URL) plus
  `recipe_ingredients` / `recipe_steps` as ordered line tables per recipe

## Phase 4 — Meal Planner Spell — **Done**
- Weekly meal plan grid (Sun–Sat, prev/today/next navigation like the Calendar Spell),
  any number of recipes per day (each assignment is its own row keyed by an id, not by
  date, so a day isn't limited to one recipe), keyed by date so past/future weeks are
  independently editable
- Two ways to add a recipe to a day: drag a recipe card directly from the **Recipes
  Spell's own dashboard card** and drop it on a day (native HTML5 drag-and-drop across
  the two Spells' independently-mounted components, coordinated by a shared drag-type
  constant), or tap a day to open a searchable recipe-picker modal — no recipe list is
  duplicated inside the Meal Planner card itself. Either action adds an entry alongside
  whatever's already assigned to that day rather than replacing it; each entry has its
  own remove (×) button
- Tapping an already-assigned recipe (rather than the day cell around it) opens it in
  the same read-only Recipe View modal the Recipes Spell uses, for viewing/preparing —
  tapping elsewhere in the day cell still opens the picker to add another
- Declares `requires: ["recipes"]` — reads the Recipes Spell's `recipes` table directly
  via a SQL join (`meal_plan_entries.recipe_id` → `recipes.id`); a deleted recipe's plan
  entries simply drop out of the view rather than dangling
- Frontend fetches the recipe list straight from the Recipes Spell's existing
  `GET /api/spells/recipes/recipes` endpoint — no duplicated recipe list on the backend

## Phase 5 — Grocery List Spell — **Done**
- A flat, persisted list (`grocery_items` table): add an item by typing it, check items
  off while shopping, remove them — the same interaction shape as the Chores Spell's
  task boards
- No backend link to the Meal Planner or Recipes Spells at all — nothing is added
  automatically. Instead, the shared Recipe View modal (used by both the Recipes Spell
  and the Meal Planner Spell) has a "Send to Grocery List" button that opens a
  checklist of that recipe's ingredients (all checked by default, plus Check
  all/Uncheck all) so the household picks exactly which lines to add before they land
  in the list — deliberately not an automatic aggregation, so the list only ever holds
  what someone chose to put there
- No `requires` — Grocery List's backend is entirely self-contained; the recipe-side
  integration is a plain frontend `fetch` into its existing `POST /items` endpoint from
  `SendToGroceryListModal.tsx`, not a cross-Spell data dependency
- Depends on: Meal Planner Spell (for the shared Recipe View entry point), Recipes Spell
  (for the ingredients being sent)

## Phase 6 — Retail Integration — **Fred Meyer/Kroger shipped (pending live sign-in test); Albertsons descoped**
- **Research spike (done 2026-07-28)** — see `docs/ARCHITECTURE.md` → "External
  integrations and open risks":
  - Fred Meyer/Kroger: **feasible.** Public API is free/self-serve, no partner approval
    needed — just an email-verified `developer.kroger.com` account + app registration.
    `authorization_code` grant + `cart.basic:write` scope for adding items to a signed-in
    shopper's cart (same shape as the existing `google-account` Spell's consent flow);
    `client_credentials` + `product.compact` for product search. Cart API adds items
    only — no checkout/order-placement endpoint exists.
  - Albertsons: **descoped.** No general-purpose public API; only partner/ad-network
    integrations exist. Moved to Backlog — revisit only if that changes.
- **Fred Meyer/Kroger implementation (done 2026-07-28)**: new `retail-kroger` Spell —
  `requires` nothing (its own OAuth provider, separate from `google-account`); Grocery
  List reads it the same plain-frontend-fetch way it already reads Recipes, no backend
  cross-Spell dependency. Settings tab connects one shopper account and picks a store
  location (needed for Product API pricing/availability); Grocery List gets a "Send to
  Fred Meyer" action that opens a per-item product search so the household manually
  matches grocery items to real products before adding them to that shopper's actual
  cart — deliberately not automatic, same philosophy as the existing "Send to Grocery
  List" flow. `GET /locations`, `GET /products`, and the OAuth `/auth/start` redirect
  were all verified live against the real Kroger API (real Fred Meyer store data and
  prices came back). **Not yet verified**: the actual `/auth/callback` consent hand-off
  and a real `POST /cart/items` add, since both need a live browser sign-in with Avry's
  own Fred Meyer account — something no automated test can do. Try connecting from the
  Fred Meyer / Kroger settings tab and sending one item to confirm end-to-end.
- **Ingredient quantity/name split (done 2026-07-28)**: product search was matching
  nothing because it searched on the full grocery line ("2 cups flour") instead of the
  ingredient name. `recipe_ingredients` and `grocery_items` now store `quantity` and
  `name` as separate columns (`server/src/ingredientText.ts` has the heuristic
  quantity/name splitter, shared by both Spells' stores; existing rows were migrated in
  place). The grocery list and Send-to-Fred-Meyer views still display the combined
  "quantity name" line, but search against just the name — and the Fred Meyer modal now
  has an editable per-item search-term field (persisted to `grocery_items.search_term`)
  for correcting a bad auto-split or a name Kroger's search doesn't recognize.
- Depends on: Grocery List Spell

## Phase 7 — Google Assistant / Home Integration — **Not started**
- **Research spike first**: Google's Conversational Actions (the old Actions on Google
  voice-command platform) were shut down in 2023. Current options are the Local Home SDK
  (device control only, not general Q&A) or routing via a self-hosted intermediary
  (e.g. Home Assistant conversation integration). This phase's design depends entirely on
  spike findings — flag to Avry before committing engineering time here.
- Goal: "Hey Google, ask [device name] to add milk to the list" style commands routed to
  the relevant Spell's action handler

## Phase 8 — Proxmox LXC Deployment — **Not started**
- Deployment target is an unprivileged LXC container on the Proxmox-hosted Dell server,
  not a Kubernetes cluster — right-sized for a single-family, single-node app with no
  need for orchestration or replicas
- The LXC runs Docker + Docker Compose internally, promoting the same
  `docker/docker-compose.yml` and container images already built for dev — no separate
  manifest format to build or maintain
- Requires nesting enabled on the container so Docker can run inside it:
  `features: nesting=1,keyctl=1` (Proxmox GUI: Options → Features, or
  `pct set <vmid> --features nesting=1,keyctl=1`)
- A prod compose override swaps the dev bind-mounts for a real `.env` (static secrets
  only — OAuth *client* IDs/secrets and other API keys, never a user's OAuth token) and
  a named Docker volume for the SQLite file (this is where the encrypted Google refresh
  token actually lives)
- LAN access from family devices (Pi, phones, laptops) via the LXC's own LAN IP/hostname
  — no ingress controller needed; a simple reverse proxy (nginx/Caddy) is optional if
  TLS termination is wanted later

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

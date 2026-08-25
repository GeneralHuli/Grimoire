# Grimoire Roadmap

Grimoire is a family aid/assistant web app built from modular features ("Spells") loaded
like MagicMirror modules. The app itself runs as a Docker Compose stack inside a Proxmox
LXC container on a Dell server; a Raspberry Pi 3B with a touchscreen is one client
endpoint (kiosk mode), alongside any desktop/tablet browser on the LAN today, with a
dedicated mobile-responsive view for phones planned next (Phase 9).

Phases are sequential but each is scoped to ship something usable on its own.

## Version 1.0 (2026-08-20)

v1.0 is every Spell a household actually uses day-to-day, presented on a themed,
no-scroll home dashboard: **Phases 0–6, Phase 7 Parts 1 & 2, and Phase 11**, detailed
phase-by-phase below. In scope: calendar, chores, recipes, meal planning, grocery lists,
Fred Meyer/Kroger cart export, in-app voice/text commands, and smart-home device control
via Home Assistant, all reachable from a drag-to-arrange widget grid with dark/light
theming.

Deliberately **not** in v1.0, carried forward as the post-1.0 roadmap: Grimoire acting as
a Google smart-home fulfillment target (Phase 7 Part 3), the Proxmox LXC production
deployment itself (Phase 8 — v1.0 has been built and run via dev Docker Compose only),
a mobile-responsive layout pass (Phase 9), and Raspberry Pi kiosk-hardware setup
(Phase 10, partially pulled forward into Phase 11 already). None of these block everyday
use on a desktop browser or the existing dev stack; they're what's left before Grimoire
runs unattended on its intended hardware for every family member.

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

## Phase 7 — Voice/Smart-Home Integration — **Parts 1 & 2 done (2026-08-05); Part 3 next**

Original framing ("Hey Google, add milk to the list" routed through an actual Google
Home speaker) turned out not to be achievable — see the research spike below. Rescoped
into three independent, separately-buildable pieces instead, each its own Spell/Ritual.
Agreed build order: **Part 1 → Part 2 → Part 3.**

- **Research spike (done 2026-08-05)** — see `docs/ARCHITECTURE.md` → "External
  integrations and open risks" for full detail:
  - Conversational Actions (the old free-text voice-command platform) shut down in 2023
    and weren't reinstated by the Oct 2025 Assistant → Gemini for Home migration —
    Google Assistant itself is being fully retired on Android/Wear OS in Sept 2026.
    Every current Google developer surface is fixed-trait device control, not free-text
    command routing — literal "Hey Google, add milk" (with milk as a captured
    parameter) isn't achievable through Google, and the Assistant SDK is
    experimental/non-commercial-only, so it isn't a building block for Part 1 either.
  - The Smart Device Management (SDM) API (Nest Device Access program) is real,
    self-serve ($5 one-time fee), OAuth2, and REST-callable from a normal backend —
    covers Nest-branded thermostats/cameras/doorbells only, including WebRTC camera
    live-view.
  - Non-Nest "Works with Google Home" devices (Hue, Kasa, etc.) are only reachable
    through Google's Device/Structure/Automation "Home APIs" — **Android/iOS-only
    native SDKs**, not callable from Grimoire's web/Node stack without embedding a
    native mobile shell.
  - Cloud-to-Cloud (the smart-home-Action fulfillment platform) can be registered and
    used indefinitely for personal/family use with a linked test Google account, no
    commercial certification required — but it's the same trait model as everything
    else, so realistically means modeling Grimoire actions as `SCENE` virtual devices
    (`ActivateScene`), i.e. fixed named commands ("Hey Google, activate Add Milk"), not
    free text.

### Part 1 — In-app voice/text command input (Spell) — **Done (2026-08-05)**
- New `voice-commands` Spell (`server/spells/voice-commands/`, `web/src/spells/
  VoiceCommandSpell.tsx`), no `requires` — same "plain frontend fetch into another
  Spell's existing endpoint" pattern the Grocery List/Recipes integration already
  established, not a backend cross-Spell dependency.
- Backend is one route, `POST /api/spells/voice-commands/parse`: reuses the Recipes
  Spell's Claude API pattern (`claude-opus-4-8`, `output_config.format`,
  `ANTHROPIC_API_KEY`) to turn command text into a structured intent. The frontend sends
  along the live grocery list, chore boards (with tasks), and recipe titles as context so
  Claude resolves names to IDs itself (handles typos/fuzzy names) rather than a
  hand-written matcher — confirmed working against real data (e.g. "mark dishes done for
  Alex" correctly resolved to the right task ID among several on that person's board).
  Also correctly resolves relative dates ("tomorrow", "next Tuesday") using the server's
  current date, since Google Assistant's SDK is a dead end for this anyway (see spike
  above).
- Note for future structured-output schemas: Anthropic's `json_schema` format does **not**
  support the OpenAI-style nullable idiom (`type: ["string", "null"]`) — every optional
  field had to be modeled as a required plain string, using `""` to mean "not
  applicable," discovered when the first schema draft was rejected by the API.
  `parseCommand.ts` is the reference example.
- Covers Grocery (add/check/remove), Chores (add/complete/reopen), Calendar
  (create/query), and Meal Plan (add/remove) — each action calls the target Spell's
  existing, unchanged REST endpoint; ambiguous/unresolvable commands return a
  clarifying question instead of guessing.
- Browser speech-to-text (Web Speech API) for capture, click-to-listen (no wake-word —
  that remains a Phase 10 kiosk-hardware stretch goal, not core scope); a typed-text
  input is always available as a fallback (needed for browsers without
  `SpeechRecognition`, e.g. Firefox/Safari) and was what got tested end-to-end, since
  headless environments can't grant a real microphone.
- **Not yet verified**: the actual mic capture / speech-to-text path, and the React UI
  rendering itself, since no headless-browser tool was available to drive/screenshot it
  in this environment — the typed-command path was verified by exercising the real
  `/parse` endpoint plus the exact follow-up calls the frontend makes (grocery add,
  chores complete/reopen round-tripped and restored). Open the app and try the mic button
  and the card's layout in a real browser to confirm those two pieces.

### Part 2 — Smart home device control + camera feeds (Spell) — **Done (2026-08-05)**
- **Rescoped away from Google entirely.** The actual goal surfaced while scoping this
  part: replace the household's Google Nest Hub outright, with every device (not just
  Nest) controllable from Grimoire's own interface — the server does the work, the
  Pi/touchscreen (and phone/desktop) are thin display clients, matching Grimoire's
  existing architecture. Two Google-native paths were considered and rejected:
  - The Device/Structure/Automation "Home APIs" covering all brands are **Android/iOS-only
    native SDKs** with no web/REST access — a hard platform constraint, not fixable from
    Grimoire's web/Node stack.
  - Running a headless Android instance on the server (Redroid) to embed those SDKs was
    considered and rejected: Google's Play Integrity API is designed to detect and can
    block sensitive flows (account linking) on emulated/non-certified devices, and it
    would add a heavy, fragile new runtime for uncertain payoff.
  - **Decision: Home Assistant is the actual smart-home backend now.** Runs as an
    ordinary Docker container (new `home-assistant` service in
    `docker/docker-compose.yml`, no new tech category), covers 2,700+ integrations across
    every major brand, and already has a mature Nest integration built on the SDM API —
    one project instead of two.
- New `smart-home` Spell (`server/spells/smart-home/`, `web/src/spells/SmartHomeSpell.tsx`
  + `SmartHomeSettings.tsx`) is a thin authenticated REST client against Home Assistant's
  own API — no OAuth flow needed at all, just a long-lived access token generated by hand
  in Home Assistant's own UI and pasted into Grimoire's Settings once (simpler than
  Kroger/Google/SDM, which all need a registered OAuth client). Setup: `docs/setup/smart-home.md`.
- Covers lights, switches, thermostats, locks, fans, and covers (one generic
  `POST /devices/:entityId/call` proxy to Home Assistant's `/api/services/<domain>/<service>`
  — adding a new control later needs no backend changes) plus camera snapshots and **live
  view via proxied MJPEG** (`/api/camera_proxy_stream/`) — simpler than originally
  planned: browsers render `multipart/x-mixed-replace` natively in a plain `<img>` tag, so
  live view needed no WebSocket client, no signed URLs, and no new frontend dependency at
  all (lower quality than HLS/WebRTC, but zero new moving parts for v1).
- Verified end-to-end against Home Assistant's own Demo integration (`demo:` in
  `configuration.yaml`) — device listing, light on/off, climate temperature adjustment,
  lock/unlock, and both camera snapshot and live-stream proxying all confirmed working
  against real HTTP responses (a real JPEG came back for the snapshot, the correct
  `multipart/x-mixed-replace` content-type for the stream).
- **Controls redone as purpose-built widgets instead of generic checkboxes/buttons**
  (2026-08-14): a vertical `SmartHomeLevelSlider` (`web/src/spells/SmartHomeLevelSlider.tsx`)
  drives light brightness, fan speed, and cover position via one shared Pointer Events
  gesture (tap toggles on/off, drag sets level live then commits on release, a long-press
  hook is reused for lights only) — filled with a CSS gradient computed from the light's
  actual `rgb_color`/`hs_color`/`color_temp_kelvin` (`smartHomeAttributes.ts`, includes a
  Kelvin→RGB approximation for color-temp-only bulbs). Long-pressing a light opens
  `SmartHomeColorPicker`, a small popover with either a hue strip + presets (RGB/HS/XY
  bulbs) or a warm↔cool strip (color-temp-only bulbs). Locks get `SmartHomeLockControl`, a
  circular button with an animated SVG shackle that swings open/closed and color-codes
  locked/unlocked/jammed. Climate gets `SmartHomeThermostatControl`, a Nest-style 270° arc
  dial (drag around the ring or use the +/- buttons) colored by `hvac_action`; dual-setpoint
  thermostats (no single `temperature` attribute, e.g. the demo's `climate.ecobee`) degrade
  to a read-only dial rather than crashing — full heat/cool range editing wasn't in scope.
  Plain switches (and fans without `percentage_step`, i.e. no speed control) get
  `SmartHomeSwitchToggle`, a sliding pill switch reused in the home-dashboard glance widget
  too. Fan speed-capability is read from `percentage_step`'s presence, not from whether
  `percentage` currently holds a number — Home Assistant reports `percentage: null` for a
  speed-capable fan that's simply off, which would otherwise wrongly fall back to the plain
  toggle. Position-capable covers reuse the level slider; others (including tilt-only covers,
  a currently-unmodeled edge case) fall back to `SmartHomeCoverControl`, an open/stop/close
  button trio that hides the stop button when `supported_features` lacks the STOP bit.
  Verified visually against the same Demo integration (headless Chrome screenshots), which
  incidentally exercised the jammed-lock and dual-setpoint-climate edge cases live.
- **Compact (home-dashboard glance) view got the same controls, plus a picker** (2026-08-14):
  the per-domain dispatch and optimistic-update logic were pulled out of
  `SmartHomeSpell.tsx` into shared `SmartHomeDeviceTile.tsx` +
  `smartHomeActions.ts`, so `SmartHomeGlance.tsx`'s "Board" widget now renders the exact
  same sliders/lock button/thermostat dial/switches as the full view (in a horizontally
  scrolling strip, `.smart-home-glance-strip`) instead of a plain checkbox list. Which
  devices show there is chosen in Settings → Smart Home → "Compact view" (a checklist
  saved as `glanceEntityIds` under the `smart-home` settings scope, same
  `PUT /api/settings/:scope` pattern Chores uses for `listIds`) rather than being
  auto-picked. Also fixed from initial user testing: the brightness/speed/position slider
  was reacting to mouse hover, not just drag (its pointermove handler wasn't gated on an
  active pointerdown); the lock's shackle-open animation rotated the wrong way into the
  body (replaced with two hand-drawn open/closed SVG paths cross-faded by opacity instead
  of a computed CSS rotation); and a fan's toggle-fallback tile rendered as an oversized
  oval (it was being flex-stretched to match its taller slider siblings, then
  `border-radius: 999px` turned the stretched rectangle into a blob -- fixed with
  `align-items: flex-end` on the tile row). All drag surfaces (level slider, thermostat
  dial, color/warmth picker strip) also got `user-select: none` -- dragging was
  highlighting the surrounding text/icons since nothing stopped the browser's default
  text-selection gesture.
- **Thermostat dial simplified** (2026-08-14): removed the +/- stepper buttons entirely
  (drag is now the only way to set a target temperature) and a pointerdown only starts a
  drag when it lands on the visible arc itself (`isOnTrack` in
  `SmartHomeThermostatControl.tsx`, a radius+angle band check) rather than anywhere in
  the dial's square hit area, so a tap in the middle no longer accidentally jumps the
  target temperature. That freed-up center area now cycles `hvac_mode` through
  heat/cool/heat_cool on tap -- filtered to whichever of those three the device actually
  reports in `hvac_modes` (`climateHvacModes` in `smartHomeAttributes.ts`), via a new
  `climate.set_hvac_mode` action (`setHvacMode` in `smartHomeActions.ts`); a device with
  fewer than two applicable modes just ignores the tap.
- **Compact view got its own draggable grid, then reworked to fill the widget with no
  scrolling and a drawer-based add flow** (2026-08-14): a small self-contained 8-wide x
  4-tall grid (`SMART_HOME_GRID_COLS/ROWS` in the new `smartHomeGrid.ts`) lives entirely
  inside the widget card, independent of the home dashboard's outer grid. Its tracks are
  CSS `1fr` (not a fixed pixel size), so the grid always exactly fills whatever the
  widget card gives it with no scrollbar; a `ResizeObserver` on the grid container
  (`SmartHomeGlance.tsx`) measures the actual rendered cell size and applies
  `transform: scale(cellPx / 104)` uniformly to every control's content so each one
  shrinks or grows to fit its allocated cell(s) rather than overflowing or clipping.
  Control sizing is still domain-driven (`controlGridSize`): thermostats 2x2,
  brightness/speed/position sliders 1x2, everything else (switches, the lock button, the
  cover open/stop/close trio) 1x1.
  Selection moved from a Settings checklist to a small gear-icon button on the widget
  itself, opening `SmartHomeGlanceDrawer` -- a slide-out palette of every controllable
  device not yet on the grid, dragged out onto the grid to place it (`pickDrawerEdge`
  picks whichever screen edge -- left/right/top/bottom -- has the most free space
  relative to the widget's own position, so the drawer always opens toward room rather
  than off-screen). Placing works via a second drag hook, `smartHomeGridInsertDrag.ts`
  (hit-tests the grid's rect on every move, since an incoming chip has no starting grid
  cell to offset from, unlike repositioning an already-placed control). Already-placed
  controls are still dragged to reposition and can be unpicked with an "x", both gated
  behind the same gear-icon edit mode -- deliberately mirroring `web/src/homeGrid`'s own
  edit-mode/drag-cell/remove-button pattern rather than inventing a different
  interaction for what's conceptually the same idea at a smaller scale. `SmartHomeSettings.tsx`
  no longer has a "Compact view" section at all now that the drawer covers it.
  The settings key changed shape from a flat `glanceEntityIds: string[]` to
  `glanceLayout: {entityId, x, y}[]` (position now implies inclusion); this was a
  breaking change to the previously-saved settings shape, so anyone who'd already picked
  compact-view devices needs to re-pick them once. Also: the lock button no longer shows
  a "Locked"/"Unlocked" text line (state is still exposed via `aria-label`) -- it was
  both visual clutter and too tall to comfortably fit a 1x1 grid cell.
- **Not yet verified**: real device pairing and real camera streaming, since this dev
  Home Assistant instance runs under Docker Desktop/WSL2 on Windows and can't reach the
  actual home LAN (mDNS/SSDP auto-discovery needs `network_mode: host`, which doesn't
  behave the same way here as on a native Linux host). This becomes testable once Home
  Assistant runs somewhere with real LAN access — most naturally the eventual Proxmox
  deployment (Phase 8).
- **Reworked into a live, room-grouped dashboard with a Summaries panel and doorbell
  popups** (2026-08-24): the Spell page now fetches `GET /api/spells/smart-home/areas`
  alongside `/devices` and renders one card per Home Assistant area/room (mixed device
  types together, matching a hand-drawn room-card sketch) instead of grouping by domain;
  ungrouped entities land in a synthetic "Other" bucket. A new right-hand
  `SmartHomeSummaryPanel` (styled after Home Assistant's own dashboard summary cards)
  shows a count per category with bulk actions where a clean on/off pairing exists —
  "All on"/"All off" (lights, fans), "Open all"/"Close all" (covers), "Lock all"/"Unlock
  all" (locks), "Pause all"/"Stop all" (media players) — each backed by one new
  `POST /api/spells/smart-home/bulk-call` request per affected domain (Home Assistant
  accepts an `entity_id` array in one service call) rather than N individual calls.
  Weather and "Maintenance" from the Home Assistant reference image were deliberately
  left out — weather already has its own Spell, and battery/maintenance sensors aren't a
  tracked domain.
  - **`media_player` is now a supported domain** — a new `SmartHomeMediaPlayerControl.tsx`
    (play/pause, stop, a volume slider, track title/artist) plus attribute helpers in
    `smartHomeAttributes.ts` reading the `MediaPlayerEntityFeature` bitmask, same pattern
    as the existing cover-stop-support check.
  - **Real-time sync, no polling**: a new persistent backend WebSocket client to Home
    Assistant (`server/spells/smart-home/haSocket.ts`, the `ws` package) subscribes to
    `state_changed` and relays every update to connected browsers over Server-Sent Events
    (`GET /api/spells/smart-home/events`, `sseHub.ts`) — a shared `EventSource` on the
    frontend (`smartHomeEvents.ts`) patches whichever tiles are on screen (spell page,
    dashboard glance widget, or both) live, including changes made outside Grimoire
    entirely (a wall switch, the Home Assistant app). The same WebSocket connection is
    also the only way to get room/area names at all — Home Assistant's REST API doesn't
    expose the area registry, only the WebSocket admin API does
    (`config/area_registry/list` + `device_registry/list` + `entity_registry/list`,
    refreshed on `*_registry_updated` events).
  - **Doorbell-ring live-feed popup**: `haSocket.ts` treats any entity with
    `device_class: "doorbell"` transitioning on (binary_sensor) or firing (`event`
    domain) as a ring, pairs it with a camera in the same area (falling back to the
    system's sole camera if there's exactly one), and pushes a `doorbell` SSE event; a
    new app-wide `SmartHomeDoorbell` component (mounted in `App.tsx`, not scoped to the
    Spell page, so a ring surfaces no matter which Spell is open) pops the shared
    `SmartHomeCameraModal` with a 5-minute auto-close timer that resets on a fresh ring.
    **Not yet verified against a real ring** — no doorbell integration is configured in
    this dev Home Assistant instance yet; the `device_class`-based detection is generic
    across integrations but needs confirming against real hardware.
  - Camera tiles shrank to small thumbnails (periodic snapshot refresh, not a live
    stream) with an "Expand" button opening `SmartHomeCameraModal` (shared with the
    doorbell popup) for the full MJPEG feed — avoids running every camera's live stream
    at once just to show a room card.
  - Verified end-to-end against the real household Home Assistant instance (not just the
    Demo integration): area grouping resolved actual room names, a device toggled
    outside the SSE test client (`switch.decorative_lights`) propagated through the
    WebSocket → SSE pipeline and updated live with no page reload.
- **Optional add-on, configured entirely inside Home Assistant, no Grimoire code**: the
  `google_assistant_sdk` Home Assistant integration (send commands *to* Google Assistant —
  casting, broadcast announcements, spoken-answer playback) — see
  `docs/setup/google-assistant-sdk.md`. Reuses the same Google Cloud project as
  `google-account` but needs its own OAuth Client ID/secret and Home Assistant's own live
  consent flow; requires Avry's own hands-on setup, not something scriptable end-to-end.
  Distinct from the `google_assistant` integration (exposing devices *to* Google Home for
  voice control), which is what Part 3 below is actually about.
  deployment (Phase 8).

### Part 3 — Grimoire as a Google smart-home fulfillment target (Ritual) — **Not started**
- Cloud-to-Cloud integration registered in the Google Home Developer Console; OAuth2
  account linking + a fulfillment webhook implementing `SYNC`/`QUERY`/`EXECUTE`. No
  visible UI (a Ritual, not a Spell) apart from a Settings tab for linking, same shape as
  `google-account`.
  Trait model realistically means one `SCENE` virtual device per canned action
  ("Grimoire: Add Milk", "Grimoire: Start Grocery Sync") activated by name — not
  arbitrary free-text commands. Test/use via a personal linked Google account; no
  commercial certification needed for private family use.

## Phase 8 — Proxmox LXC Deployment — **Not started**
- Deployment target is an unprivileged LXC container on the Proxmox-hosted Dell server,
  not a Kubernetes cluster — right-sized for a single-family, single-node app with no
  need for orchestration or replicas
- The LXC runs Docker + Docker Compose internally, promoting the exact same
  `docker/docker-compose.yml` and Dockerfiles already used in dev, no separate manifest
  or prod-only compose file needed — the SQLite file already lives on a named Docker
  volume (`grimoire_data`) rather than a bind mount, even in dev, so the only real
  difference between dev and prod is which `server/.env`/`docker/.env` values are filled
  in (static secrets only — OAuth *client* IDs/secrets and other API keys, never a
  user's OAuth token, which stays encrypted in SQLite regardless of environment)
- Requires nesting enabled on the container so Docker can run inside it:
  `features: nesting=1,keyctl=1` (Proxmox GUI: Options → Features, or
  `pct set <vmid> --features nesting=1,keyctl=1`)
- LAN access from family devices (Pi, phones, laptops) via the LXC's own LAN IP/hostname
  — no ingress controller needed; a simple reverse proxy (nginx/Caddy) is optional if
  TLS termination is wanted later
- Full step-by-step instructions: `docs/setup/proxmox-deployment.md`
- **Known limitation**: `docker/server.Dockerfile` and `web.Dockerfile` run `npm run dev`
  (tsx watch / Vite dev server) in prod too, since this plan promotes the existing dev
  images rather than building dedicated production bundles — fine for a single-family
  LAN app, just not as lean as a real `npm run build` + static-serve setup. A
  production-build Dockerfile pass is a reasonable future improvement, not a blocker.

## Phase 9 — Mobile-Friendly Web App — **Not started**
- Responsive layout pass so every Spell's UI works on phone/tablet viewports, not just
  the touchscreen kiosk's fixed resolution
- Likely a PWA (installable, works offline for read-mostly views like the meal plan)
- Depends on: core Spells from Phases 1-5 having stable UIs to make responsive

## Phase 10 — Kiosk Polish (Raspberry Pi client) — **Not started**
- Chromium kiosk mode on the Pi touchscreen, pointed at the Grimoire server on the LAN
- Module layout configuration and the theming pass originally scoped here shipped early,
  as Phase 11 below — what's left is specifically the Pi hardware/kiosk-mode setup
- Fixed early (2026-08-25): every UI icon was an emoji character, which rendered blank
  on the Pi's Chromium (Raspberry Pi OS ships no color emoji font by default). Replaced
  app-wide with `lucide-react` icon components — see "Frontend conventions" in
  `docs/ARCHITECTURE.md`.

## Phase 11 — Home Dashboard Redesign — **Done (2026-08-13)**
- Pulled forward from Phase 10 (module layout configuration, theming) plus a new Weather
  Spell, done together since the "everything visible on one no-scroll screen" goal drove
  all three at once.
- **Dark mode, default-on**: a real CSS custom-property token layer
  (`web/src/index.css`) with a `data-theme` attribute, replacing the old
  OS-only `canvas`/`canvastext`/`color-scheme: light dark` approach. Dark is the default
  when no choice is saved (not just a system-preference fallback); "System"/"Light" stay
  available in Settings → General, plus a one-tap toggle in the new side dock.
  `web/src/appState/ThemeContext.tsx` is this app's first Context provider.
- **Weather Spell** (`server/spells/weather/`, `web/src/spells/WeatherSpell.tsx` +
  `WeatherSettings.tsx`): Open-Meteo (free, keyless forecast + geocoding APIs) —
  location is searched and saved once in Settings (no browser geolocation, since this is
  a stationary kiosk display), with a short server-side in-memory cache on forecast
  responses.
- **Navigation shell**: a persistent side icon dock
  (`web/src/components/SideDock.tsx`) listing every Spell; tapping one opens that
  Spell's existing, unmodified full component full-screen
  (`web/src/components/SpellDetailView.tsx`). View state lives in
  `location.hash` (`web/src/appState/ViewContext.tsx`) — free back-button support, no
  router dependency added.
- **Home widget-grid engine** (`web/src/homeGrid/`): the homepage is now an
  Android-launcher-style grid, fixed-size and non-scrolling, where every Spell declares
  one or more compact "glance" widget size variants
  (`web/src/spells/homeWidgets/registry.tsx`) rather than rendering its full card
  unconditionally like before. An "Edit Layout" mode supports dragging widgets to
  reposition (Pointer Events–based, `web/src/homeGrid/dragEngine.ts` — HTML5 DnD was
  ruled out for lacking touch support) with live valid/invalid drop highlighting, and
  tapping to cycle through a Spell's declared sizes. Layout persists via
  `GET/PUT /api/settings/layout` (no backend changes needed — the generic settings store
  already supports arbitrary scopes); a hand-picked default layout
  (`web/src/homeGrid/defaultLayout.ts`) applies and saves itself on first run so the
  homepage is never blank.
- Every existing Spell (Calendar, Chores, Recipes, Meal Plan, Grocery List, Voice
  Commands, Smart Home) got new glance-widget components as part of this phase, not
  deferred — see each Spell's `web/src/spells/<Spell>Glance.tsx`. Smart Home also gained
  one new backend route, `GET /api/spells/smart-home/summary`, for a condensed
  per-domain device-count widget (the only glance widget needing a new endpoint; every
  other one reuses its Spell's existing endpoint).
- **Calendar's "Month" glance widget shows event titles per day, not just a dot** (2026-08-20):
  each day cell in `CalendarMiniMonthGlance` now renders its first event's title (ellipsized)
  plus a "+N" count, mirroring the full `CalendarSpell` month view instead of a bare
  presence dot. Tapping a day pops a fixed-position day-detail panel
  (`.mini-month-overlay`) out over whatever sits to the widget's right — sized to one of
  the widget's own grid columns and positioned via a measured `getBoundingClientRect`,
  the same idea as the Smart Home glance's slide-out drawer, so it works regardless of
  what's actually placed next to it on the dashboard or whether the widget is flush
  against the grid's edge. A new, wider size variant, "Month + Day"
  (`CalendarMonthDayGlance`, `HOME_WIDGET_VARIANTS.calendar`), permanently reserves that
  extra grid column instead of popping it out on demand, defaulting to today and updating
  in place when another day is tapped.
- **Not yet verified**: real-device drag/tap interaction on an actual touchscreen (typechecked
  and lint-clean, and manually reachable in a desktop browser, but this environment has
  no way to drive a real touch input) — try Edit Layout on the Pi/kiosk touchscreen once
  deployed there to confirm the drag gesture feels right.

## Backlog / later ideas
- Additional Spells as they come up (explicitly expected — the module architecture exists
  so new Spells don't require touching the core app)
- Multi-user profiles / permissions per family member
- Notifications (push to phones when chores assigned, groceries low, etc.)

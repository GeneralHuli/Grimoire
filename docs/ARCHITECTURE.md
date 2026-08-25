# Grimoire Architecture

## Topology

```
                        ┌─────────────────────────────┐
                        │  Proxmox host (Dell server)  │
                        │  ┌────────────────────────┐  │
                        │  │  LXC container           │  │
                        │  │  (Docker Compose)        │  │
                        │  │  - grimoire-server (API) │  │
                        │  │  - grimoire-web (static) │  │
                        │  │  - SQLite on named volume│  │
                        │  └────────────────────────┘  │
                        └───────────────┬──────────────┘
                                        │ LAN
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
      ┌───────▼────────┐       ┌────────▼────────┐       ┌────────▼────────┐
      │ Raspberry Pi 3B │       │  Phones/Tablets  │       │  Laptops/other   │
      │ + touchscreen   │       │  (mobile PWA)    │       │  (browser)       │
      │ Chromium kiosk  │       │                  │       │                  │
      └────────────────┘       └──────────────────┘       └──────────────────┘
```

The Pi never runs the application — it's a thin client pointed at the server's LAN
address in kiosk mode. This means the server-side architecture is designed for the
Proxmox host's resources, not the Pi's, while the frontend is designed to be responsive
across kiosk, mobile, and desktop viewports from day one.

## Repo layout

```
Grimoire/
  server/            Node/TypeScript API (Express/Fastify)
    src/
      moduleLoader.ts   Scans spells/, loads manifests, registers routes
      index.ts          App entrypoint
    spells/             Each subfolder is a Spell: spell.json + backend code (calendar,
                        chores, recipes, meal-plan, grocery-list, retail-kroger,
                        google-account, voice-commands, smart-home, weather)
  web/               React + TypeScript frontend (Vite)
    src/
      spells/           Full-screen component + home-dashboard "glance" widget(s) per
                        Spell, dynamically rendered by manifest
      homeGrid/         Home dashboard widget-grid engine — layout, drag, resize (see
                        "Home dashboard" below)
      appState/         Theme + view-state React Context providers (see "Theming" below)
      components/       App shell: header, side dock, settings modal, spell detail view
  docker/            Dockerfiles + docker-compose.yml — also promoted to the Proxmox
                     LXC container for prod (Phase 8), no separate manifest format
  docs/              Roadmap, architecture, decisions
    setup/           Per-integration one-time setup guides (Google, Kroger, Home
                     Assistant/Smart Home)
```

## Spell architecture (module system)

Modeled on MagicMirror: a Spell is a self-contained directory with a manifest describing
what it provides, so the core app never hardcodes feature-specific logic.

`spells/<name>/spell.json`:
```json
{
  "name": "calendar",
  "displayName": "Family Calendar",
  "version": "0.1.0",
  "backend": "./index.ts",
  "frontend": "calendar",
  "config": {
    "position": "top-left"
  }
}
```

- **Backend**: `moduleLoader.ts` walks `spells/`, imports each manifest's `backend` entry,
  and calls a standard `register(app, config)` export to mount routes under
  `/api/spells/<name>/...`.
- **Frontend**: the web app fetches the list of enabled spells + their `config` from the
  server on boot, and dynamically renders the matching component from `web/src/spells/`.
  Layout position/size comes from config, not code, so rearranging the kiosk grid doesn't
  require a redeploy.
- Each Spell owns its own DB tables/migrations — the core app only owns the spell
  registry table.
- A manifest may declare `"requires": ["other-spell-name"]`. `moduleLoader.ts` validates
  every dependency exists before loading anything (fails startup loudly if one is
  missing) and topologically orders loading so a dependency's module always loads before
  its dependent — see "Shared Google sign-in" below for why this exists.
- **Rituals**: a Spell whose manifest sets `"kind": "ritual"` is purely functional — it
  has no `frontend` and never renders on the App home page (it may still register a
  custom Settings panel; see below). Rituals exist for cross-cutting things other
  Spells depend on, like shared auth. Because other Spells are likely to depend on them,
  `moduleLoader.ts` always loads every Ritual before any ordinary Spell, regardless of
  discovery order and independent of explicit `requires` edges.
- **Settings**: every Spell automatically gets a tab in the Settings modal, including
  Rituals. The generic key/value editor (`SpellSettingsPanel`) is the default, reading/
  writing `/api/settings/:scope` (scope = the Spell's manifest `name`, or `general` for
  app-wide settings) — manifest `config` acts as defaults, and saved values override
  them. A Spell can register a custom panel instead in
  `web/src/spells/settings/registry.tsx`, keyed by manifest `name`, when the generic
  editor isn't enough (see `GoogleAccountSettings`). `/api/settings/:scope` works for
  *any* scope string with zero pre-registration — `layout` (the home dashboard's saved
  widget positions, see "Home dashboard" below) is a second example of a scope with no
  matching Spell manifest, alongside `general`; it just has no Settings-modal tab of its
  own since it's edited via the home screen's own Edit Layout mode instead.

### Shared Google sign-in

Rather than each Google-backed Spell (Calendar, and Chores in Phase 2) running its own
OAuth flow, a standalone **`google-account` Ritual** owns the family's one Google sign-in
and requests every scope any dependent Spell needs (Calendar + Tasks today) in a single
consent screen. Dependent Spells declare `"requires": ["google-account"]` in their
manifest and call `getAuthorizedClient()` from `spells/google-account/client.ts` (a
normal cross-Spell import — Spells aren't process-isolated, just organizationally
separated) to get a ready-to-use OAuth2 client, or `null` if no account is linked yet.
It has no home-page card of its own — only a Settings tab for linking/unlinking the
account.

The refresh token this produces is **never** stored in the prod `.env` file or any
Compose config — it only ever lives encrypted (AES-256-GCM, see `secretBox.ts`) in the
`google_account_tokens` SQLite table, written by the interactive `/auth/callback` flow.
The only Google-related values that belong in the prod `.env` (Phase 8) are
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — they identify the Grimoire app's own OAuth
client registration, not any user's session, so they're static config rather than a
per-account secret.

## Frontend conventions

These are house rules for any Spell's frontend, not just the ones that first needed
them — apply them when building a new Spell's UI rather than re-deriving a one-off.

**Action buttons live at the top, locked.** Every page, modal, and settings panel puts
its action buttons (Save, Delete, Close, Import, etc.) in a non-scrolling row at the
top, structurally outside the scrollable content rather than CSS-`sticky`'d over it:
- The app header (`.grimoire-header`) is `position: sticky; top: 0` above the dashboard
  grid.
- Every standalone modal is a flex column: a `.modal-actions` row (title + buttons) as
  a non-scrolling first child, and a single `.modal-body` that scrolls — see
  `CalendarEventModal.tsx` or any `Recipe*Modal.tsx` for the pattern.
- The Settings modal is the one exception that needs `position: sticky` rather than
  structural separation: several panels (General, per-Spell) share one scrolling
  `.settings-content` region, so each panel renders its own Save button as
  `.settings-panel-actions`, pinned to the top of that shared scroll area.
- Rationale: on the kiosk touchscreen (and vertically-cramped mobile viewports later,
  Phase 9), a long list must never be able to scroll a Save/Close button out of reach.

**Every button and text field composes the shared `.btn`/`.field` primitives.**
`web/src/index.css` defines `.btn` (with `.btn-sm`/`.btn-lg` size modifiers,
`.btn-icon`/`.btn-icon-lg` for circular icon buttons, `.btn-danger` for destructive
actions, and an `.active`/`[aria-pressed="true"]` selected state) and `.field` for text
inputs, selects, and textareas. A Spell should never redeclare padding/radius/tint/font
for a button or input — add the class instead, and if a genuinely new visual variant is
needed, extend the primitives rather than one-offing it per Spell. Per-Spell CSS should
only ever add layout (flex/gap/margin), not color or shape. The one deliberate exception
is a handful of intentionally "ghost" (no background) minimal buttons — `.recipe-star`,
`.grocery-remove`, `.meal-plan-clear`, `.meal-plan-entry-title` — which are a distinct,
already-mutually-consistent affordance (a quiet inline action, not a primary button) and
shouldn't be forced onto `.btn`.

**Cross-Spell frontend drag-and-drop.** Spells rendered as separate dashboard cards can
still be a native HTML5 drag source/drop target pair — no coordination layer needed
beyond agreeing on a `dataTransfer` MIME key. The Recipes Spell's recipe cards
(`draggable`, `onDragStart`) are the drag source for the Meal Planner Spell's day cells
(`onDragOver`/`onDrop`); the shared key lives in `web/src/spells/recipeDrag.ts`
(`RECIPE_DRAG_TYPE`) and is imported by both Spells. Follow the same shape for a future
cross-Spell drag interaction rather than inventing a new mechanism: one small shared
constant module, imported by whichever Spells need it — still no runtime coupling
beyond that. This only holds for *desktop-mouse* drag, though: HTML5 DnD has no reliable
touch support, so the home dashboard's widget-repositioning drag (below) is a genuinely
different, Pointer Events–based mechanism (`web/src/homeGrid/dragEngine.ts`) rather than
a reuse of `recipeDrag.ts` — touch is the primary input on the kiosk this app targets.

**Shared modal reused across Spells, not duplicated per Spell.** `RecipeViewModal` is
owned by the Recipes Spell but is imported directly by the Meal Planner Spell too
(tapping an assigned day's recipe opens the same component the Recipes Spell uses) —
an ordinary cross-Spell TS import, same as the backend's cross-Spell SQL joins, just on
the frontend. Its "Send to Grocery List" button is the Grocery List Spell's *only* link
to recipe data: a plain `fetch` into Grocery List's existing `POST /items` endpoint from
`SendToGroceryListModal.tsx`, not a manifest `requires` or a shared table — Grocery
List's backend has no dependency on Recipes/Meal Planner at all. This was a deliberate
choice over Phase 5's original design (an automatic cross-Spell SQL join aggregating
every planned recipe's ingredients): the household picks which ingredients to send via a
checklist rather than everything landing in the list automatically.

### Theming

Dark is the default theme, not a fallback for missing settings. `web/src/index.css`
defines a small CSS custom-property token layer (`--grim-bg`, `--grim-surface`,
`--grim-text`, `--grim-border`, `--grim-accent`, `--grim-danger`) with dark values on
bare `:root` and light overrides under `[data-theme="light"]`; most existing rules
already use `color-mix(in srgb, currentColor N%, transparent)` and adapt automatically
once the root text color changes, so the token layer only had to touch the handful of
rules that used the raw `canvas`/`canvastext` OS keywords. `web/src/appState/theme.ts`
resolves a saved `"system" | "light" | "dark"` choice (from the `general` settings scope)
against `prefers-color-scheme`, and `web/src/appState/ThemeContext.tsx` (this app's first
Context provider) applies it by setting both `document.documentElement.dataset.theme`
and the `color-scheme` CSS property directly — the second part matters because it makes
native form controls follow the app's explicit choice even when it disagrees with the
OS setting, rather than leaving `color-scheme: light dark` for the browser to resolve on
its own. A one-tap toggle lives in the side dock; the full three-way choice is also in
Settings → General.

### Home dashboard (widget grid)

The homepage (`web/src/homeGrid/HomeGrid.tsx`) is an Android-launcher-style widget grid,
fixed at `GRID_COLS × GRID_ROWS` cells (`web/src/homeGrid/gridConfig.ts`) and capped to
the viewport height with `overflow: hidden` — that fixed sizing, not any per-widget
scroll trick, is what keeps the homepage on one screen. Each Spell that wants to be
placeable on it registers one or more size variants — small purpose-built "glance"
components distinct from its full interactive view — in
`web/src/spells/homeWidgets/registry.tsx` (`HOME_WIDGET_VARIANTS`), the same
manifest-name-keyed shape as `SPELL_COMPONENTS`/`SPELL_SETTINGS_COMPONENTS`. A Spell
absent from that registry simply isn't placeable on the grid; it's still reachable
full-screen via the persistent side dock (`web/src/components/SideDock.tsx`), which
lists every Spell with a `frontend` regardless of whether it's on the home screen. The
dock and the "which Spell view is showing" state are driven by
`web/src/appState/ViewContext.tsx`, whose source of truth is `location.hash`
(`#/spell/<name>`) — cheap back-button/refresh support with no router dependency.

A placed widget's position/size (`{ spellName, widgetId, x, y, w, h }`) is persisted via
`GET/PUT /api/settings/layout`, one JSON array under a single `widgets` key — an empty
result applies `web/src/homeGrid/defaultLayout.ts`'s hand-picked first-run arrangement
and immediately persists it, so a fresh install isn't a blank homepage. Editing the
layout ("Edit Layout" mode) uses a Pointer Events–based drag
(`web/src/homeGrid/dragEngine.ts`) rather than HTML5 DnD, unifying mouse/touch/pen for
the kiosk touchscreen; the dragged card's live position is a CSS `transform`, not a
per-render state update, so an invalid drop (checked live via
`web/src/homeGrid/collision.ts`) is free — clearing the transform snaps it back with no
layout-state change. Resizing is a tap-to-cycle through a Spell's *declared* size
variants (not freeform corner-drag) since sizes are fixed by the Spell, not chosen
arbitrarily by the household. Every edit (move / resize / remove / add via the widget
drawer) `PUT`s the layout immediately — no separate Save step, matching an Android
launcher's "changes are live" model.

## Data storage

SQLite (via `better-sqlite3`), single file on a named Docker volume inside the Phase 8
LXC container. Fits the "lightweight
database" requirement and needs no separate DB server. If a Spell's access patterns
outgrow SQLite later (e.g. heavy concurrent writes), that Spell can swap its own storage
without affecting others, since each Spell owns its own tables.

## External integrations and open risks

| Integration | Status | Notes |
|---|---|---|
| Open-Meteo (Weather Spell) | Done | Free, keyless REST APIs (`api.open-meteo.com` for forecasts, `geocoding-api.open-meteo.com` for location search) — no OAuth, no `.env` credential, unlike every other external integration in this table |
| Google Calendar | Done | Shares the `google-account` Ritual's OAuth2 client + Calendar scope |
| Google Tasks | Done | Shares the same `google-account` Ritual, using the Tasks scope requested alongside Calendar's |
| Recipe URL import | Done | Parses `schema.org/Recipe` JSON-LD out of the page's own `<script type="application/ld+json">` blocks — no HTML-scraping library needed |
| AI recipe generation | Done | Single structured-output call to the Claude API (`claude-opus-4-8`, `output_config.format`); needs `ANTHROPIC_API_KEY` in `server/.env`, unlike the rest of the Recipes Spell |
| Fred Meyer / Kroger | **Spike complete (2026-07-28) — feasible** | Kroger's Public API (`developer.kroger.com`) is free, self-serve — no business/partner approval gate, just an email-verified account + app registration to get OAuth2 client credentials. `product.compact` (product search) and `cart.basic:write` (add items to a signed-in user's cart) are the relevant scopes; product/location lookups use `client_credentials`, cart writes need the `authorization_code` flow (Fred Meyer shopper signs in and consents, same pattern as the existing `google-account` Spell). Rate limits: ~10,000 calls/day products, ~1,600/day per location endpoint, ~5,000/day cart+identity. The Cart API only *adds items* — there's no checkout/order-placement endpoint, so "export to cart" is the ceiling, not "place the order." |
| Albertsons | **Spike complete (2026-07-28) — no general public API; descoped to manual-export/backlog** | No general-purpose developer API exists. The only public Albertsons APIs found are partner/ad-network integrations (Albertsons Media Collective, for retail-media advertisers) and a meal-planning API limited to specific partners — neither is a fit for an unaffiliated app adding grocery items to a cart. Revisit only if Albertsons opens a public cart API later; until then, Phase 6 implementation should cover Kroger/Fred Meyer only. |
| Google Assistant / Home | **Spike complete (2026-08-05) — rescoped into 3 parts; Parts 1 & 2 shipped** | Conversational Actions (free-text voice commands to a third party) shut down in 2023 and weren't reinstated by the Oct 2025 Assistant → Gemini for Home migration (Google Assistant itself is being fully retired on Android/Wear OS in Sept 2026). Every current Google developer surface is fixed-trait *device control*, not free-text command routing — literal "Hey Google, add milk to the list" (milk as a captured parameter) isn't achievable through Google, and the Assistant SDK is experimental/non-commercial-only. Rescoped into 3 independent pieces (see `docs/ROADMAP.md` Phase 7 for full detail and status): **(1) done** — an in-app voice/text command Spell (Web Speech API + the existing Claude API integration, no Google dependency). **(2) done, but not the way originally scoped** — the real goal turned out to be full smart-home device control (all brands) from Grimoire's own interface, and Google's own path for that (the Device/Structure/Automation "Home APIs") is Android/iOS-only native SDKs with no web access at all; a headless-Android-on-the-server workaround was considered and rejected (Google's Play Integrity API can block account-linking on emulated devices). **Home Assistant is the actual backend now** — an ordinary Docker container, 2,700+ integrations across every brand including a mature Nest integration, with the new `smart-home` Spell as a thin authenticated client against it (no OAuth needed, just a pasted-in long-lived token) — REST for device listing/control, plus a persistent WebSocket connection (relayed to the browser over Server-Sent Events) for live state sync and room/area names, since Home Assistant only exposes its area registry over the WebSocket API. **(3) not started** — a `google-fulfillment`-style Ritual making Grimoire itself a Cloud-to-Cloud fulfillment target (`SYNC`/`QUERY`/`EXECUTE`), usable indefinitely for personal/family use with a linked test account and no commercial certification — realistically modeled as one `SCENE` virtual device per canned action, not free text. |

Both spikes are called out explicitly in the roadmap (Phase 6 and Phase 7) so they happen
before implementation work, not mid-phase. The Phase 6 spike (Kroger/Fred Meyer feasible,
Albertsons descoped) is done — see `docs/ROADMAP.md` Phase 6 for the resulting scope. The
Phase 7 spike (Google path infeasible for free-text commands, rescoped into 3 parts) is
done — see `docs/ROADMAP.md` Phase 7 for the resulting scope decision and per-part
status.

## Deployment environments

- **Dev**: Docker Compose on the dev machine (Docker Desktop), hot-reload for server + web
- **Prod**: Docker Compose inside an unprivileged Proxmox LXC container on the Dell
  server (Phase 8), same `docker-compose.yml`/Dockerfiles as dev — a manual `git clone` +
  `docker compose up` on the LXC (`docs/setup/proxmox-deployment.md`), not a CI/CD
  pipeline; the existing CI (Phase 0) only runs lint + typecheck on push, nothing deploys
  automatically yet

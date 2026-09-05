# Spark

**A campaign engine for tabletop RPGs — generate the content, build the maps, and run the
session live, in one place.** Starting with D&D 5e.

**[Try it at sparkdm.quest](https://sparkdm.quest)** — free for up to 3 worlds, no card required.

Spark covers the whole arc of a campaign rather than one slice of it:

- **Prep** — generate NPCs, monsters, items, locations, quests, factions, dungeons, regions,
  settlements, shops, and multi-part adventures, all consistent with the world you've built.
- **Build** — a tile-by-tile battle map builder, wired for movement, sight, elevation, and
  hazards the moment you finish painting it. Nothing to import or align.
- **Run** — a real-time shared Battle Grid with fog of war, initiative, HP and conditions,
  dice and chat, synced to every player, plus a companion view they can follow from their phones.
- **Between sessions** — Doom Clocks, faction relationships that shift on their own, World Tick,
  and downtime resolution, so the world keeps moving on the weeks you don't have time to prep.

## What it does

### Prep — generate content, fast

Generation is meant to spark ideas, not cage them: once something's saved, every field is yours
to rewrite from the Roster, and most entry types can also be written from a blank page with
**Create Your Own** instead of generated. The **Create** tab covers NPCs & Monsters, Items,
Locations, Quests, Factions, Encounter Tables, Dungeons, Regions, Settlements, Shops, and
Adventures (multi-part quest chains) — each with its own "surprise me completely" fully-random
mode, sampled from a curated SRD-based dataset so results vary run to run.

The **Compendium** tab is quick-reference material for the table: a Bestiary (SRD monster stat
blocks by CR), a spell list, conditions, and core rules — searchable, no need to generate or
save anything to look something up.

### World — organize a campaign

Everything generated can be **saved to your Roster**, tagged, annotated, linked to other
entries (an NPC works for a Faction, is found at a Location, gives a Quest, carries an Item —
bidirectional, cleaned up automatically when either side is deleted), and organized into
**Worlds** (campaign containers). A world's owner can generate an invite code and hand it to
players; anyone who joins gets read access to public content plus write access to the
collaborative tools below (and none at all for DM-only planning content marked hidden).

- **Roster** — browse, search, and filter everything you've saved, and fully edit it in place.
- **Codex** — a shared, player-writable knowledge base for what the party has actually learned
  in-world, separate from the DM's private Roster notes.
- **Notes** — session recaps (summary, loose threads, next steps) with a **Timeline** view and
  shareable, downloadable **Recap Cards**; DM-only fields stay hidden from the player-facing
  version. A pinned **Last Session** view and a shared **Next Session** date/reminder keep
  everyone oriented between sessions.
- **Downtime** — a shared log for downtime activities (crafting, commissioning work from a
  shop, travel between locations/settlements), with House Rules to tune the numbers a world
  uses for encounter balance, downtime, and crafting.
- **Tavern** — the campaign's social/economic hub: a **Home Base** the party can upgrade
  (defense rating, faction influence, rest bonuses — each purchase has a real mechanical
  effect elsewhere in the app), rendered as an explorable map, plus a **Guild Board** for
  importing quest hooks as claimable jobs with completion payouts.
- A DM-facing **automation layer** for running a living world between sessions: **Trigger
  Rules** (if/then automation during combat), **Doom Clock** (a visible countdown toward a
  looming threat), **Faction Relations** (a relationship web between factions with
  stance-styled links and an event log) with **Autonomous Wars** (simulate and resolve
  faction-vs-faction battles), and **World Tick** (propose and apply world-state changes
  between sessions).

### Play — run it live at the table

The **Combat** tab is the at-the-table toolkit, and its panes work together in real time once a
world is selected:

- **Dice Roller** — quick d4–d20 buttons plus a custom-expression roller (`2d6+3`), a personal
  roll history, and in Party mode a shared **party roll log** with reactions everyone in the
  world can see and post to. Any roll can be **applied straight to combat**.
- **Initiative Tracker** — build an encounter (monsters, player characters, or custom
  combatants), track initiative, HP, AC, conditions, and **concentration**, with an
  encounter-difficulty analyzer to sanity-check a fight before it starts. In Party mode this
  becomes **Live Session Mode**: encounter state syncs to every party member in real time
  (server-sent events, no polling), with per-combatant control over whether HP shows exactly
  or only as a status band. **Spellcasting** resolves common spell effects (damage, healing,
  conditions) straight onto combatants. A one-click **Rest** resets HP/conditions and applies
  any Home Base rest bonus.
- **Map Builder** and the **Battle Grid** — paint tile-based maps (multiple tile packs, floor
  and decor layers, GM-only markers only the DM can see) and drop them into an encounter for
  tactical play: grid movement, elevation/flight, area-of-effect templates, opportunity-attack
  reminders, and **fog of war with dynamic lighting** (including light carried by combatants)
  that's computed server-side per viewer so players only ever see what their token could
  actually see. Dungeons can chain multiple rooms/maps together with persistent state as the
  party moves between them (cleared rooms, fled monsters, and loot stay put).
- **Shop** — a per-world storefront for buying and selling items, and commissioning crafted
  goods from a shop's stock, both feeding the party's shared ledger (see below).
- **Cast to Table** opens a read-only, big-screen presentation view of the live encounter (fog
  and DM-only content already stripped) for a second monitor or TV — no login needed for that
  tab. A **mobile player companion view** (a QR-coded link, not the full desktop app) gives
  each player their own phone-sized view of the encounter, their character sheet, and an
  opt-in "it's your turn" notification.

Every player gets a **My Character** page for a full character sheet (equipment, spellcasting
resources, HP/rest state) that levels up with XP, and can be built through a guided
**Character Creation** wizard or imported by pasting an existing sheet's text. A shared **Party
Ledger** tracks gold and items with claimable loot drops from combat, and small **activity
badges** across the World/Play tabs flag new rolls, notes, or live updates without needing a
tab open.

### Account — profile, sharing, and billing

- **Gallery** — publish Roster entries (including Battle Maps and Dungeons) publicly for other
  Spark users to browse and import into their own worlds, with a report/moderation flow to
  keep it clean.
- **Profile** — account settings plus **Legacy**, a cross-campaign rollup of everything you've
  accomplished across every world you own or have joined.
- **Billing** — see [Subscription tiers](#subscription-tiers) below.
- **Moderation** and **Users** — admin-only tools; see [Admin & moderation](#admin--moderation).

The app is also an installable **PWA** with an offline app shell.

## Subscription tiers

Billing runs on Stripe (`server/src/routes/billing.ts`), flipping each account's `tier` between
`"free"` and `"paid"` via webhook. Free tier is fully functional — paid removes a handful of
caps and unlocks table-wide DM tooling for whichever world a paying DM owns (one DM's
subscription covers the whole table). Current gates, defined in `shared/src/billingLimits.ts`
plus a few inline checks:

- **Worlds**: 3 on free, unlimited on paid.
- **Battle Maps**: 3 on free, unlimited on paid.
- **Generations per minute**: 60 on free, 240 on paid.
- **Roll log / party chat history**: most-recent 100 rows visible on free; full history on paid.
- **Fog of war & dynamic lighting**: paid-DM-owned worlds only — free-tier worlds render full
  visibility instead.
- **Home Base upgrades**, **Trigger Rules**, **Doom Clock**, **Autonomous Wars** (applying a
  battle), and **World Tick** (applying a proposal): gated on the world owner's tier — a DM's
  own subscription unlocks these for every player at their table.
- **Cross-Campaign Legacy**: gated on the requesting account's own tier (it's a personal
  rollup, not something a table shares).

The Billing page's comparison table is the source of truth for exact current numbers.

## Admin & moderation

There's no in-app way to grant admin access — it's controlled by a single environment
variable, `ADMIN_USERNAMES` (comma-separated usernames), the same way Stripe/R2 keys are
configured. `server/src/routes/auth.ts` checks that list on every signup/login/session check
and promotes or demotes the account's role to match automatically — add or remove a name and
it takes effect on that account's next request, no manual database edit either direction.

Admin role unlocks:
- **Moderation** — reviewing Gallery reports, revoking/restoring a user's ability to publish.
- **Users** — searching accounts, resetting a locked-out user's password or recovery code
  (there's no email field on `User` at all, so this is the account-recovery path).
- **Stats** — basic usage/admin dashboards.

Admin role is independent of subscription tier — promoting someone to admin does not give them
paid-tier features, and vice versa.

## Stack

- **Client**: React + TypeScript + Vite, code-split by route
- **Server**: Express + TypeScript (run directly via [`tsx`](https://github.com/privatenumber/tsx), no build step), structured logging via pino
- **Database**: SQLite via Prisma
- **Shared**: a `shared` workspace package with the SRD dataset, TypeScript types, Zod
  validation schemas, and the generation/simulation engines, consumed directly by both client
  and server (no separate build step)
- **Billing**: Stripe Checkout/webhooks
- **Real-time**: Server-Sent Events for live world updates, with optional Redis pub/sub to
  fan out across multiple server instances
- **Error monitoring**: Sentry (optional — see below)
- **Testing**: Vitest (unit/integration, all three workspaces) + Playwright (e2e), CI on GitHub Actions

This is an npm-workspaces monorepo: `shared/`, `server/`, `client/`.

## Getting started

```bash
npm install

# one-time: create the SQLite database
cp server/.env.example server/.env
npm run --workspace server prisma:migrate

# run both in separate terminals
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173.

Everything above works with zero configuration. A handful of things are optional and stay
fully functional without them — see `server/.env.example` and `client/.env.example` for the
full list, but briefly: **Stripe** keys (billing/checkout — routes just return 503 without
them), **R2** credentials (automated database backups — no-ops without them), **REDIS_URL**
(only needed once you run more than one server instance), and **Sentry DSNs** (error
reporting — errors just stay in local logs without them).

## Testing

```bash
npm test --workspace shared   # unit tests
npm test --workspace server   # integration tests (spins up a scratch SQLite test DB)
npm test --workspace client   # component tests
npm run test:e2e --workspace client   # Playwright, against a real running dev server
```

GitHub Actions runs the three `npm test` suites on every push/PR.

## Production build

```bash
npm run build          # builds the client to client/dist
npm run start:server   # runs the API with tsx
```

In production the Express server serves the built `client/dist` itself (with an SPA
fallback for client-side routes) alongside `/api/*`, so a single running process is
enough — no separate static host or reverse proxy required.

## Deploying to Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions this as one paid **Starter** web service with a 1GB persistent disk
(mounted at `/var/data`) holding the SQLite database, so everything you save survives
restarts and redeploys.

1. Push this repo to GitHub (already done if you're reading this from the PR).
2. In the Render dashboard: **New > Blueprint**, connect this repo, and Render will
   read `render.yaml` and propose the `spark` service + disk.
3. Click **Apply** (you'll need a payment method on file — this uses a paid plan, not
   the free tier, specifically so the SQLite disk persists).
4. On first deploy, the start command runs `prisma migrate deploy` before starting the
   server, so the database schema is created automatically on the disk.
5. Fill in the optional `sync: false` env vars in Render's dashboard for whichever integrations
   you want live: Stripe keys for billing, R2 credentials for backups, `REDIS_URL` if scaling
   past one instance, `SENTRY_DSN`/`VITE_SENTRY_DSN` for error monitoring, and
   `ADMIN_USERNAMES` for admin/moderation access — none of these are declared with a value in
   `render.yaml` itself (secrets aren't committed), and the app runs fine with any or all of
   them left unset. Note `VITE_SENTRY_DSN` is read at **build** time (Vite inlines it into the
   client bundle), not runtime, so it needs to be set before a deploy, not just present at
   startup.

Want a free-tier deploy instead? Change `plan: starter` to `plan: free` and delete the
`disk` block in `render.yaml` — but note the SQLite file will then reset on every
redeploy and periodically on restart, so treat Roster/Worlds as non-persistent in that
configuration.

## Project layout

```
shared/       SRD dataset, types, Zod schemas, and the generation/simulation engines
              (characters, items, locations, quests, factions, encounter tables, dungeons,
              regions, settlements, vision/fog raycasting, grid movement, battle resolution,
              encounter balance, house rules)
server/       Express API + Prisma/SQLite persistence: entity CRUD, cross-entity search &
              links, world sharing, session notes, player characters & leveling, party
              ledger/loot, live encounters & Battle Grid (incl. fog redaction), real-time
              SSE + pub/sub, chat, Tavern/Home Base, Guild Board, the DM automation layer
              (Trigger Rules, Doom Clock, Faction Relations, World Tick), Gallery publishing,
              moderation/admin tooling, Stripe billing, R2 backups, structured logging
client/       React SPA, organized into four nav areas — Prep (Create, Compendium), World
              (Overview, Worlds, Roster, Codex, Notes, Downtime, Tavern), Play (Combat incl.
              Battle Grid, Map Builder, Shop), Account (Gallery, Profile, My Character,
              Billing, Moderation, Users) — plus a mobile player-companion view and a
              read-only Cast to Table presentation view
render.yaml   Render Blueprint for a one-click paid deploy with a persistent disk
```

## Data & licensing note

Stat blocks are derived from the D&D 5e System Reference Document (SRD), which is
available for reuse. All other flavor text (names, personality/backstory tables, monster
epithets, item/location/quest/faction/encounter flavor content) is original content
written for this project.

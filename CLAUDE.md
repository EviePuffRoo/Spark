# Working on Spark

Spark is a prep-and-run companion for tabletop RPGs: generate campaign content, build
battle maps, and run the session live on a shared grid. The [README](README.md) covers
what it does for a user. This file covers how it's built, and — more usefully — why
certain things are the way they are, including the approaches that were tried and
rejected. Read it before making structural changes.

Live at [sparkdm.quest](https://sparkdm.quest). Deployed from `main` via `render.yaml`.

## Layout

npm workspaces, three of them, and the dependency direction only ever runs one way:

```
shared/   pure TypeScript: types, 5e rules, generators. No I/O, no React, no Prisma.
server/   Express + Prisma (SQLite) + zod. Imports shared.
client/   React + Vite. Imports shared. Talks to server over HTTP + SSE.
```

`shared/` is the load-bearing one. Anything that is a *rule* rather than a *screen* or
an *endpoint* belongs there: initiative, movement and vision on the grid, encounter
balance, concentration, opportunity attacks, crafting, weather, the world tick. It has
no side effects, so it's cheap to test exhaustively and both other workspaces can trust
it. Resist the pull to put rules logic in a route handler or a component — when the same
rule ends up implemented twice, the two copies drift and the bug shows up as "the server
and the client disagree about what just happened at the table."

## Commands

Run from the repo root unless noted.

```bash
npm install                       # installs all three workspaces; runs prisma generate

npm run dev:server                # tsx watch, port 4000
npm run dev:client                # vite, port 5173; proxies /api to :4000

npm test --workspace server       # vitest; migrates test.db first via pretest
npm test --workspace shared       # vitest
npm test --workspace client       # vitest (jsdom)
npm run lint --workspace client   # oxlint
npm run build --workspace client  # tsc -b && vite build — this is the typecheck too
npx tsc --noEmit                  # from server/ — server has no build step

npm run test:e2e --workspace client   # Playwright; starts both servers itself
```

CI (`.github/workflows/ci.yml`) runs exactly these on every push and PR, in two jobs
(`checks` and `e2e`). If all of the above pass locally, CI passes — there is no extra
step it does that you can't run.

`.github/workflows/discord-changelog.yml` posts merged commits to the project Discord.
It reads the event payload from `$GITHUB_EVENT_PATH` with `jq` rather than interpolating
commit messages into shell — commit messages contain apostrophes and newlines, and
interpolation broke the workflow the first time around.

## Server conventions

**Access control lives in `src/worldAccess.ts` and nowhere else.** This is the most
important convention in the codebase. Four rules, each defined once:

- `findAccessibleWorld` — owner or member. Read / narrow-write.
- `canWriteWorld` — owner or a `coDM` member. Actual write access.
- `visibleEntityWhere` / `listVisibleWhere` — your own rows, plus non-hidden rows in a
  world you can reach. This is the filter every entity list route needs.
- `authorizeEntityWrite` — ownership wins, else coDM on the attached world.

A world's owner has no `WorldMember` row of their own, so the `userId` arm of each
filter is *not* redundant — dropping it silently hides entities other users saved into
a world you own but never joined. These were previously copy-pasted across ~48 call
sites; they're helpers now so a change to what "visible" means lands everywhere at once,
and so a new entity type gets the rule right by construction. Add a route, use the
helpers. Don't hand-roll an `OR` clause.

**Every JSON column goes through `parseColumn` in `src/serialize.ts`.** Rows can arrive
from a hand-edited backup, a restored dump, or a direct DB edit. A throw inside a
serializer fails the whole request, so one damaged row would 500 an entire list endpoint
and take out the user's roster. `parseColumn` falls back to a deliberately blank
constant (`EMPTY_STAT_BLOCK` and friends) — blank rather than plausible, so the user
sees damage they can fix instead of invented content they'd trust.

**Lenient parsing for nested fields, strict for required ones.** `src/validation.ts`
gives you `parseArray` and `parseOptional`: malformed items are dropped, not rejected.
Top-level required fields are still checked by the handler and still 400. This matches
how the write routes have always behaved.

**zod strips unknown keys.** Adding a field to a shared type is half the job — if it
travels through a request body you must also add it to that route's schema, or it is
silently dropped on save with no error anywhere. This has bitten more than once; most
recently `mapEdge` on `dungeonExitSchema`.

**Read-modify-write on SQLite needs a lock.** See `withEncounterLock` in
`routes/encounters.ts` and `withBaseLock` in `routes/base.ts`. Two concurrent requests
that each read gold, decide, then write will both spend it. If you add a route that
reads state and then writes based on what it read, serialize it per world the same way.

**Prisma relation filters beat multi-query checks.** `{ members: { some: { userId } } }`
in one query, not "fetch the world, then fetch its membership row." Selecting a relation
makes Prisma issue a second SELECT, which is the thing to avoid.

**Codes are looked up by blind index, not by scanning.** World join codes are bcrypt
hashed, which can't be queried. The fix was an HMAC-SHA256 `joinCodeLookup` column
(`codeLookupDigest` in `src/auth.ts`) giving an O(1) indexed lookup alongside the hash.
There's a legacy scan fallback for codes issued before the column existed — keep it
until you're sure none remain. Use this pattern for any future secret you need to *find*
rather than only *verify*.

## Client conventions

Pages in `src/pages/`, components in `src/components/`, one file each. Contexts for
auth and active world; small focused hooks (`useLocalStorage`, `useTheme`,
`useWorldLiveChannel`) rather than a store library.

**Memoize anything that builds an array of JSX per frame.** The grid and map builder
paint hundreds to thousands of SVG nodes. Rebuilding those arrays on every pointer move
during a drag reconciles the whole map each frame. `GridMap.tsx` and `MapBuilderPage.tsx`
memoize tile layers, grid lines, shading and the palette; keep new grid work inside that
pattern. Pure builders (like `buildTileShading`) are pure specifically so callers can
memoize them on the tile list.

**Extract panels out of large components rather than growing them.** `InitiativeTracker`
went from 1671 lines and 47 state variables to 1269 and 28 by moving attack, cast and
loot into their own components. It is still the biggest component in the app and the
next natural extraction is worth doing when you're next in there.

**Never style map content with UI tokens.** The grid lines used `var(--border)` — a
near-white lavender meant for panel edges — drawn over dark dungeon art, where it read
as a bright mesh sitting on top of the map. They're `rgba(0, 0, 0, 0.2)` now. UI tokens
are tuned against the app's chrome; map art is arbitrary and often dark. This one-line
change did more for how a map reads than either of the two much larger visual features
that followed it.

## The battle map's visual layer

`TileShading.tsx` derives depth from the tiles already placed — no new art, no extra
data on the map. Read its header comment before changing any of it; the constants are
tuned, not arbitrary. Three things it does and the reasoning that isn't obvious:

- **Light is directional, from the north-west.** Shading all four sides of a solid tile
  equally rings an isolated pillar in a dark box, which reads as a painted square rather
  than a shadow. Casting south-east gives the map one consistent light and lets a pillar
  throw a real drop shadow. The lit sides keep a faint contact shade so objects stay
  seated on the floor.
- **"Tall" means `blocksVision`**, not "blocks movement." A table or a chest blocks
  movement but you see over it, so it must not cast a wall's shadow.
- **Seams are restricted to `category === "terrain"`, deliberately.** Keying them off
  the same "blocks sight" test the shadows use drew a box around every altar, chest,
  table and stair. Those are objects standing on ground, not materials meeting, and
  outlining them made them look pasted on. Don't widen this filter.

**Tried and rejected: per-cell tint variation** to break up large stone fields. At every
strength where it was visible at all, it read as blotchy rather than textured. Don't
retry it without a different approach entirely.

## Tiles that cross other tiles: the span layer

A cell holds one tile per layer — `floor`, `span`, `decor`, `gmOnly` — and a *span* is a
bridge or rope bridge laid across the ground rather than instead of it. Before it existed
a bridge painted over a chasm overwrote it, so the chasm stopped existing: it didn't draw
either side of the deck, and erasing the bridge left a hole rather than the terrain.

Two things make this work, and both matter:

- **`standingTileAt` in `shared/src/mapCells.ts` is the only definition of which placement
  a cell's rules come from** (the span if there is one, else the floor). `gridMovement.ts`
  and `vision.ts` each used to carry their own copy of that lookup; a bridge the movement
  engine lets you cross but the vision engine still reads as an open chasm is exactly the
  drift that convention exists to prevent. Anything that asks "what is at this cell"
  should call into that module, never re-derive it.
- **The art has to be open-sided**, or none of it is visible. A bridge whose symbol starts
  with a full-cell `<rect>` covers the chasm just as completely as overwriting it did. The
  deck is a band across the middle with the two sides left clear, and `spanDeckAngles`
  rotates it to whichever axis the neighbouring spans run along. That's auto-tiling in the
  one place the tileset can afford it — two tiles, one symbol and a rotation, against
  variant art per neighbour bitmask across all 58.

**Considered and rejected: a numeric elevation stack** — the floor layer holding N tiles
per cell sorted by `PlacedTile.elevation`, top of stack wins. It's the more general model
and it's what an earlier note in this file proposed, but it buys nothing the span layer
doesn't: it needs tie-break rules for two tiles at the same height, it makes "paint a
chasm at -20 *first* or the bridge replaces it" a trap the DM has to know about, and it
puts numeric ordering between a DM and the one thing they actually wanted, which was to
draw a bridge over a hole. A span is always above its floor by definition, so there is
nothing to order and nothing to explain.

The layer generalises: a new tile that should cross terrain rather than replace it only
needs `span: true` in `battleTiles.ts` — the builder routes it, the renderer stacks it,
and the rules engine reads it, with no other change.

**The ceiling here is real.** True auto-tiling — variant art selected per neighbour
bitmask — needs variants authored for all 58 tiles. The neighbour-derived rims and seams
reach a similar goal from the other direction, but they're refinements. A further
step-change in how the tileset looks has to happen *inside the tile art*, not as another
overlay pass.

## Testing

**Server** — `vitest.config.ts` sets `fileParallelism: false` on purpose: every file
shares one SQLite `test.db`, and parallel files mean concurrent writers against one
file. `tests/resetDb.ts` clears tables by walking Prisma's runtime datamodel, so new
models are picked up automatically and you don't hand-list tables.

Give slow tests an explicit timeout. `joinCodeScaling.test.ts` spends ~4.6s in bcrypt
against vitest's 5s default and flaked on CI, failing an unrelated PR. If a test does
real cryptographic work, set the timeout rather than hoping.

**e2e** — Playwright, `client/e2e/`, excluded from vitest by `vitest.config.ts`. The
config starts both servers itself against a dedicated `server/prisma/e2e.db`, so a run
never touches your `dev.db` or the vitest `test.db`.

Hard-won e2e practicalities:

- **Kill stale servers before a run**: `fuser -k -9 4000/tcp 5200/tcp`. `reuseExistingServer`
  is false, so a leftover dev server holding port 4000 makes runs hang for 10+ minutes
  with no useful error.
- **Use short per-test timeouts.** A long file-level `test.setTimeout` doesn't make a
  bad selector pass, it just makes you wait 15 minutes to find out.
- **The default viewport is too small for a large map.** `test.use({ viewport: { width: 1920, height: 1400 } })`
  for anything grid-related; otherwise the canvas clips and click coordinates land in
  the wrong cell.
- **Don't write captures to `test-results/`** — Playwright wipes it each run. Use
  `client/showcase-out/` (gitignored).
- `getByRole("combobox", { name: ... })` where `getByLabel` times out; `selectOption`
  wants a value string, not a `{ label: /re/ }` object.
- Stacked grid tokens: pointer events hit the topmost DOM node, so iterate candidate
  targets in reverse.
- SVG `<text>` has no `innerText` — use `.evaluate(el => el.textContent)`.
- The svg letterboxes via `preserveAspectRatio`, so clip math must intersect the content
  bbox with the svg element's own rect.

**One-off specs are scratch, not tests.** `client/e2e/tmp-*` is gitignored: committing
one would add it to the suite CI runs. Seeding data straight into `e2e.db` with a
`tmp-seed-*.mjs` script is the fast way to iterate on how something *looks* — ~20s a
cycle versus two minutes rebuilding through the UI. One caveat learned the hard way:
writing directly to the DB bypasses the API's coercion, so you must supply fields the
routes would have defaulted (a zone with no `tags: []` crashed the app and looked
exactly like a product bug until it was bisected).

## Conventions for changes

Commit subjects are imperative and describe the *effect*, not the mechanism —
"Stop one malformed row from 500ing an entire list endpoint", not "Add try/catch to
serialize.ts". Put the reasoning in the body, especially anything you tried and backed
out; that's the part nobody can recover from the diff.

Work happens on a branch and lands through a PR. There's no PR template — describe what
changed, why, and what you ran.

When you fix something subtle, leave the reasoning in a comment at the site. Most of the
comments in this codebase exist because someone would otherwise "simplify" the code back
into the bug. That's the intended standard, not over-commenting.

## Known-unsolved

- **`InitiativeTracker.tsx`** is still the largest component after three extractions.
- **Distribution, not code, is the bottleneck.** Launch posts to several subreddits were
  duds. Worth weighing before picking up more feature work.

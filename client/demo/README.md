# The showcase rig

Drives the real app to **record** it, rather than to assert on it. Everything
here is deliberately outside `client/e2e/`: these files end in `.demo.ts` and
run under `playwright.demo.config.ts`, so neither the CI e2e suite nor vitest
can pick them up. A segment that stalls waiting for a nice-looking pause must
never be able to fail somebody's PR.

## Running it

```bash
cd client

# Everything: seed, then all three segments.
npm run demo

# One segment, against the world already seeded.
npx playwright test --config=playwright.demo.config.ts --project=map-builder

# Start over with a fresh world.
SPARK_DEMO_RESEED=1 npm run demo:seed
```

In this container Chromium is not at the revision Playwright expects, so point
at the installed one — the same variable `playwright.config.ts` already reads:

```bash
export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

Kill stale servers first if a previous run died holding a port:
`fuser -k -9 4000/tcp 5200/tcp`.

## Output

Everything lands in `client/showcase-out/`, which is gitignored:

```
showcase-out/
  demo-world.json          the seeded world's ids and credentials
  video/<segment>--<view>.webm    raw, as recorded
  beats/<segment>.json            the edit decision list
  parts/                          normalised to 1920x1080 @ 30fps (demo:assemble)
  cut-list.txt                    every beat on the assembled timeline
```

`video/` and `beats/` are the deliverable. A beat sheet is a labelled list of
offsets into that segment's recording:

```json
{ "segment": "03-live-combat",
  "videos": { "dm": "…--dm.webm", "table": "…--table.webm" },
  "beats": [ { "t": 41200, "label": "FOG: vision extends east", "view": "table" } ] }
```

Both views of a two-camera segment share one clock, so a cut can put the same
instant on both halves of a split screen without scrubbing for it.

## How it is put together

- **`demoWorld.ts`** — the seeded campaign, and the only place content lives.
  Built entirely through the HTTP API, never by writing to `e2e.db`: direct DB
  writes skip the routes' coercion, and the failure mode is a screen that
  crashes on a field the API would have defaulted, which looks exactly like a
  product bug on camera. Nothing here calls a generator either — the
  generators use `Math.random`, so a re-shoot would rename the party and break
  continuity with segments recorded earlier.

- **`demoKit.ts`** — the rig. Injects a cursor (Playwright drives input
  through CDP, so the page gets real mouse events but nothing is ever drawn),
  a caption bar, and a click ripple; glides the pointer instead of teleporting
  it; converts grid cells to viewport points through the browser's own
  `getScreenCTM` rather than by arithmetic; and collects the beat sheet.

- **`seed.demo.ts`** — runs before every segment and is idempotent. If
  `demo-world.json` still names a world this server can serve, it is reused
  untouched. That is what makes a segment independently re-shootable:
  re-recording the map builder next week lands on the same party, the same
  maps and the same names the combat segment was shot against.

## Assembly

`npm run demo:assemble` uses the ffmpeg Playwright ships for its own video recording, so
there is nothing to install. That build is deliberately minimal, though — scale, pad,
crop, trim, transpose, and the matroska/webm muxer, and no more — so the script checks
for what it needs instead of assuming it:

- **Always**: normalises every clip to 1920x1080 at 30fps into `parts/`, and writes
  `cut-list.txt` — every labelled beat renumbered onto the assembled timeline.
- **Given a full ffmpeg** (`FFMPEG_PATH=/usr/bin/ffmpeg npm run demo:assemble`): also
  composites the two-camera segment picture-in-picture, and joins everything into
  `spark-tour.webm`.
- **Given Playwright's**: lays the two views out as consecutive clips and prints the
  parts in order, because `overlay` and the concat demuxer are not compiled in.

The real edit wants the beat sheets rather than this script's output. Both views of the
two-camera segment carry their own start offset, so aligning them is arithmetic:
`videoTime = beat.t - videos[view].offsetMs`.

## The segments

| project | what it has to prove |
| --- | --- |
| `generation` | A world already full of people and places, and a generator that fills a stat block in one click. |
| `map-builder` | Maps are hand-built from a fixed tileset: a chasm with a real height, a bridge that spans rather than replaces it, a tile that turns. |
| `live-combat` | Two synchronised screens — the DM's numbers and hidden markers against the table's status badges and fog. The only segment that cannot be shot from one browser. |
| `town` | The half of a campaign that isn't a fight: records, a shop that spends one shared purse, the tavern hub. |
| `downtime` | Weeks between sessions, and crafting priced by the item's own rarity rather than by argument. |
| `dungeon` | A room that remembers — disarm a trap, walk away, come back, and it is still disarmed. |
| `world-tick` | Time passing, as a proposal the DM approves item by item rather than a fait accompli. |

## Adding a segment

1. Write `demo/NN-name.demo.ts` — `loadDemoWorld()`, `openView()`, drive it.
2. Register it as a project in `playwright.demo.config.ts` with
   `dependencies: ["seed"]`.
3. Keep it independent of every other segment. One flaky beat should cost one
   clip, never the whole take.

## Things learned the hard way

- **The app caps its own content at 1100px** (`.app-content`, App.css), so on
  a 1920 frame roughly a quarter is empty gutter and the battle grid draws at
  570x380 — a tenth of the picture — whether the viewport is 1366 or 1920.
  `SHOOT` zooms `#root` to 1.33 so the app lays out near the frame edge. That
  is a shooting workaround; on a wide monitor a real DM sees the same small
  map.
- **Zoom the app root, not the viewport.** Playwright does not scale the
  viewport up to a larger `recordVideo.size` — it composites it at natural
  size into the corner, so a 1440x810 viewport recorded into 1920x1080 came
  out with a black band down two sides. Zoom `#root` (never `body`, or the
  recorded cursor and captions scale with it) and record at the viewport size.
- **`locator.scrollIntoViewIfNeeded()` times out inside a CSS-zoomed
  subtree**, and it fails as a 20-second hang naming the right element, which
  reads like a wrong selector and is not one. `glide()` wheel-scrolls instead.
  The same is true of anything that waits on actionability — the kit clicks
  with raw `page.mouse` events for this reason.
- **Scroll once, deliberately.** The map builder's palette has its own
  `overflow-y` (`max-height: 75vh`), so picking a tile scrolls the palette and
  leaves the canvas alone. Scroll the page once to frame the canvas and it
  stays framed for the whole segment.
- **Clear the caption before clicking anything low on screen**, or the lower
  third covers the control being pressed.
- Several forge pages have a Generate/Create Your Own mode toggle *and* a
  submit button, and the toggle is also called "Generate".
  `.generator-layout .btn-primary` is the one that runs it, whatever verb that
  particular forge uses ("Draft Quest Hook", "Sketch Location").
- A world's name is an `<option>` in the header picker as well as a heading,
  and the hidden option matches first. Assert on the heading.
- **The area sidebar is itself a `.grouped-tabs`**, and it comes first in the
  DOM — so `.grouped-tabs` alone gets you the sidebar's Campaign/Records/
  Downtime, not the page's own tabs. Scope to `.roster-mode-tabs` /
  `.create-type-tabs`.
- **A dungeon exit belongs to one zone**, and the zone panel lists only the
  selected zone's exits. Walking a party means selecting the zone that owns
  the door, not any zone in the room.
- An input with a `datalist` has the ARIA role `combobox`, not `textbox`.
- **Loading a dungeon room does not reset the zone map's pan.** Measured
  walking narthex → nave: the new room's zones render at y = -371, entirely
  above the canvas. The segment hits the map's own Reset after every room
  load; a DM has to do the same at the table.
- **Selecting a zone while another zone's panel is open is unreliable**, and
  it cost this segment eight takes to pin down. The segment now jumps between
  rooms through the Load Dungeon picker instead of walking exits — same
  `loadRoom` underneath, so the leave-report and the room memory are
  identical, but it never has to select a zone in a room whose panel is
  already open.
- Doom clocks are gated behind a paid tier, and the demo accounts are
  ordinary free ones on purpose — a tour shot from a privileged account shows
  a product nobody signing up will get.

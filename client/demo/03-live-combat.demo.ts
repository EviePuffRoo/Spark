import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage, armEncounter, demoCombatantId } from "./demoWorld";
import { Segment, openView, badge, say, click, hold, drag, cellPoint, frame } from "./demoKit";

// Segment 3 — the same fight, on two screens at once.
//
// This is the segment that cannot be shot from one browser, and it is the
// one carrying the most weight: everything before it a DM could believe from
// screenshots. Two synchronised views is the claim that Spark is a table
// tool rather than a prep tool.
//
// So it records two contexts side by side and drives only one of them:
//   dm     — the tracker, with every number, every hidden marker, no fog.
//   table  — the same world at ?present=<worldId>: read-only, no app chrome,
//            monster hit points replaced by a status badge, hidden
//            combatants dropped entirely, and every cell the party cannot
//            currently see fogged out.
//
// Nothing is pushed from this script to the table view. It updates because
// the server broadcasts the encounter over SSE and the page is listening —
// which is the whole point, and why the beat sheet timestamps both views
// against one clock. In the edit they sit side by side, or the table view
// rides in a corner; either way the cut needs to know which frame on the
// left goes with which frame on the right.
//
// The encounter is armed over the API first (armEncounter in demoWorld.ts),
// because twenty seconds of adding combatants one at a time is not the
// footage anyone needs.
const CELL = 32;

test("segment 3 — live combat on two screens", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("03-live-combat");

  // Put the fight into the world before either camera rolls.
  const arming = await browser.newContext({ baseURL: "http://localhost:5200" });
  await arming.request.post("/api/auth/login", { data: { username: demo.dm.username, password: demo.password } });
  await armEncounter(arming.request, demo);
  await arming.close();

  const dmView = await openView(browser, {
    name: "dm",
    segment,
    signIn: { username: demo.dm.username, password: demo.password },
    storage: demoStorage(demo),
  });

  // The cast screen carries the DM's own session — that is exactly how the
  // feature is used, a second window off the same browser onto a TV.
  const tableView = await openView(browser, {
    name: "table",
    segment,
    signIn: { username: demo.dm.username, password: demo.password },
    url: `/?present=${demo.worldId}`,
    zoom: 1.15,
  });

  const dm = dmView.page;
  const table = tableView.page;

  try {
    // --- Both screens, live on the same encounter ---
    await badge(dm, "DM");
    await badge(table, "The Table");

    const rail = dm.locator("nav.nav-rail");
    const side = dm.locator("nav.area-sidebar");
    await expect(rail).toBeVisible();
    await click(dm, rail.locator('button:has-text("Play")'));
    await click(dm, side.locator('button:has-text("Combat")'));
    await expect(dm.locator(".initiative-tracker")).toBeVisible();

    const tracker = dm.locator(".initiative-tracker");
    await click(dm, tracker.getByRole("tab", { name: "Party" }));
    await expect(dm.locator(".combatant-row").first()).toBeVisible({ timeout: 20_000 });
    segment.beat("live encounter loaded", "dm");

    await click(dm, dm.getByRole("button", { name: "Show Battle Grid" }));
    const dmGrid = dm.locator(".grid-map-svg > g[transform]").first();
    await expect(dm.locator(".grid-map-svg")).toBeVisible();
    await frame(dm, dm.locator(".grid-map-svg"), { at: 0.5 });
    await hold(900);

    await expect(table.getByRole("button", { name: "Battle Grid" })).toBeVisible({ timeout: 20_000 });
    await click(table, table.getByRole("button", { name: "Battle Grid" }));
    await expect(table.locator(".grid-map-svg")).toBeVisible();
    // Framed once. Nothing else is ever clicked on this screen, so the map
    // stays put for the whole segment — which is what makes it usable as the
    // constant half of a split screen.
    await frame(table, table.locator(".grid-map-svg"), { at: 0.52 });
    segment.beat("cast screen showing the same map", "table");
    await hold(1200);

    await say(dm, "The DM's screen: every number, every marker, no fog.");
    await say(table, "The table's screen: the same fight, only what the party can see.");
    segment.beat("SPLIT: DM vs table, same instant", "both");
    await hold(4000);

    // --- A token crosses the bridge, and the second screen finds out ---
    await say(dm, null);
    await say(table, null);
    const brannoc = dm.locator(".grid-token").filter({ hasText: "Brannoc" }).locator("rect").first();
    const start = await brannoc.boundingBox();
    if (!start) throw new Error("Brannoc's token is not on screen");

    segment.beat("DRAG: Brannoc towards the chasm", "dm");
    await drag(dm, { x: start.x + start.width / 2, y: start.y + start.height / 2 }, await cellPoint(dmGrid, 8, 7, CELL), 30);
    await hold(1400);
    await say(dm, "Move a token, and it moves on the table screen too.");
    segment.beat("token move mirrored over the live channel", "table");
    await hold(2600);

    await say(dm, null);
    const onBridge = await cellPoint(dmGrid, 12, 7, CELL);
    const mid = await brannoc.boundingBox();
    segment.beat("DRAG: across the bridge over the chasm", "dm");
    await drag(dm, { x: mid!.x + mid!.width / 2, y: mid!.y + mid!.height / 2 }, onBridge, 34);
    await hold(1600);
    await say(dm, "He crosses on the bridge — the chasm is still under him.");
    await say(table, "The party's light moves with them, and the fog opens.");
    segment.beat("FOG: vision extends east, Grix comes into view", "table");
    await hold(4200);

    // --- An attack, resolved by the rules and shown to both screens ---
    await say(dm, null);
    await say(table, null);
    const row = dm.locator(".combatant-row").filter({ has: dm.locator(".combatant-name", { hasText: "Brannoc Duskbarrow" }) });
    await click(dm, row.getByRole("button", { name: "⚔ Attack" }));
    const attack = row.locator(".attack-panel");
    await expect(attack).toBeVisible();
    // By value, not label: the option reads "Grix (AC 17)", and matching on
    // that would break the moment the panel changes how it labels a target.
    await attack.locator("select").first().selectOption(demoCombatantId("foe", "Grix"));
    await attack.getByLabel("To-hit bonus").fill("7");
    await hold(700);

    segment.beat("ROLL: to hit", "dm");
    await click(dm, attack.getByRole("button", { name: "Roll to Hit" }));
    await expect(attack.locator(".encounter-roll-result").first()).toBeVisible();
    await hold(1800);

    await attack.getByLabel("Damage dice").fill("2d6+4");
    segment.beat("ROLL: damage, applied to the target", "dm");
    await click(dm, attack.getByRole("button", { name: "Roll Damage & Apply" }));
    await hold(1600);
    await say(dm, "The DM sees the hit points.");
    await say(table, "The table sees only that something hurt.");
    segment.beat("SPLIT: numbers vs status badge", "both");
    await hold(4000);

    // --- A spell, and the turn passing ---
    await say(dm, null);
    await say(table, null);
    await click(dm, row.getByRole("button", { name: "⚔ Attack" }));
    const wizard = dm.locator(".combatant-row").filter({ has: dm.locator(".combatant-name", { hasText: "Maerwyn Ashgrove" }) });
    await click(dm, wizard.getByRole("button", { name: "✨ Cast" }));
    const cast = wizard.locator(".cast-panel");
    await expect(cast).toBeVisible();
    await cast.getByLabel("Spell").selectOption("magic-missile");
    await hold(900);
    await say(dm, "Prepared spells resolve by their own rules — damage, saves, conditions.");
    segment.beat("CAST: magic missile", "dm");
    await hold(2400);

    await say(dm, null);
    await click(dm, dm.getByRole("button", { name: "Next Turn" }));
    await hold(1200);
    await click(dm, dm.getByRole("button", { name: "Next Turn" }));
    await hold(1200);
    await say(table, "Whose turn it is, on the screen everyone is looking at.");
    segment.beat("TURN: order advances on both screens", "both");
    await hold(3400);

    await say(dm, null);
    await say(table, null);
    await badge(dm, null);
    await badge(table, null);
    await hold(800);
  } finally {
    await dmView.finish();
    await tableView.finish();
    segment.write();
  }
});

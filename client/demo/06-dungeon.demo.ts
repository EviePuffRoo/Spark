import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage, armEncounter, resetDungeonRooms } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, clickUntil, hold, type, frame, SHOOT } from "./demoKit";

// Segment 6 — running a dungeon room by room, and what a room remembers.
//
// The claim here is narrower than "we have dungeons" and much more useful:
// a room the party cleared stays cleared, a trap they disarmed stays
// disarmed, and a monster that fled leaves the room alerted — across a
// session boundary, without the DM writing any of it down.
//
// That memory is the feature this repo spent a PR getting right (the client
// used to fetch-merge-PUT the whole rooms array, and two of those in flight
// lost the sticky alerted flag). So the segment is shot to show it working
// rather than to show a map: enter the crypt, disarm its trap, walk away,
// come back, and watch the trap still be gone.
//
// It re-arms the encounter first so the party is on their tokens, and the
// dungeon it loads is seeded, so nothing here depends on another segment.

test("segment 6 — a dungeon that remembers", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("06-dungeon");

  if (!demo.dungeonId) throw new Error("The seeded world has no dungeon — reseed with SPARK_DEMO_RESEED=1.");

  const arming = await browser.newContext({ baseURL: "http://localhost:5200" });
  await arming.request.post("/api/auth/login", { data: { username: demo.dm.username, password: demo.password } });
  await armEncounter(arming.request, demo);
  // And put the dungeon back to pristine, or the trap this segment exists to
  // disarm is already disarmed from the last take.
  await resetDungeonRooms(arming.request, demo);
  await arming.close();

  const view = await openView(browser, {
    name: "dm",
    segment,
    signIn: { username: demo.dm.username, password: demo.password },
    storage: demoStorage(demo),
    ...SHOOT,
  });
  const { page } = view;

  try {
    const rail = page.locator("nav.nav-rail");
    const side = page.locator("nav.area-sidebar");
    await expect(rail).toBeVisible();

    await badge(page, "The Dungeon");
    await click(page, rail.locator('button:has-text("Play")'));
    await click(page, side.locator('button:has-text("Combat")'));
    const tracker = page.locator(".initiative-tracker");
    await click(page, tracker.getByRole("tab", { name: "Party" }));
    await expect(page.locator(".combatant-row").first()).toBeVisible({ timeout: 20_000 });

    await click(page, page.getByRole("button", { name: "Show Zone Map" }));
    await expect(page.locator(".zone-map-svg")).toBeVisible();
    await frame(page, page.locator(".zone-map-svg > g[transform]").first(), { at: 0.52 });
    await hold(800);

    // --- Load the dungeon, pick a room to start in ---
    await beatSay(page, segment, "A dungeon is rooms, and the party is in one of them.", 2800);
    await say(page, null);
    await click(page, page.getByRole("button", { name: "Load Dungeon" }));
    await type(page, page.getByPlaceholder("Search dungeons…"), "Sunken");
    await hold(900);
    await click(page, page.locator("button.entity-item").filter({ hasText: "Sunken Abbey" }).first());
    await hold(1000);
    segment.beat("CLICK: start in the narthex");
    await click(page, page.locator("button.entity-item").filter({ hasText: "Flooded Narthex" }).first());
    await hold(1800);
    await frame(page, page.locator(".zone-map-svg > g[transform]").first(), { at: 0.52 });
    await beatSay(page, segment, "Walk them through it — the room loads, and so does its map.", 3000);

    // --- Walk to the crypt, which is trapped ---
    await say(page, null);
    // The group, not its circle: the pointer handler is on the <g>, and a
    // click on the circle alone did not open the panel.
    const zoneNode = (name: string) => page.locator(".zone-map-svg .zone-node").filter({ hasText: name }).first();
    const moveTo = (room: string) => page.locator(".button-row").filter({ hasText: room }).getByRole("button", { name: "Move Party" }).first();
    // Selecting a zone opens its panel; clicking the circle can land before
    // React has re-rendered the selection when the machine is busy encoding
    // the previous segment's video. Click until the panel is actually there.
    // noScroll: the zone map handles the wheel itself to zoom, so scrolling
    // toward a node pushes it away instead of bringing it into view.
    const selectZone = (name: string) =>
      clickUntil(page, zoneNode(name), page.getByRole("button", { name: "Close", exact: true }), 4, { noScroll: true });

    await selectZone("Broken Doors");
    await hold(800);
    segment.beat("MOVE: into the nave");
    await click(page, moveTo("Nave"));
    await hold(2000);
    await frame(page, page.locator(".zone-map-svg > g[transform]").first(), { at: 0.42 });

    await selectZone("The Crossing");
    await hold(800);
    segment.beat("MOVE: down into the crypt");
    await click(page, moveTo("Crypt"));
    await hold(2200);
    await frame(page, page.locator(".zone-map-svg > g[transform]").first(), { at: 0.42 });

    // The proof has to be on screen, not implied: select the trapped zone
    // and frame its Hazard panel, because that panel is the only place the
    // room's memory is visible.
    await selectZone("Ossuary");
    await hold(700);
    const hazardHeading = page.getByRole("heading", { name: "Hazard" });
    await expect(hazardHeading).toBeVisible();
    await frame(page, hazardHeading, { at: 0.42 });
    await hold(900);
    await beatSay(page, segment, "This one is trapped, and it's the room that knows it — not the DM's notes.", 3600);

    // --- Disarm it ---
    await say(page, null);
    segment.beat("CLICK: clear the hazard — the trap is disarmed");
    await click(page, page.getByRole("button", { name: "Clear Hazard" }));
    await hold(1800);
    await beatSay(page, segment, "Disarm it once.", 2400);

    // --- Leave, come back, and it is still disarmed ---
    await say(page, null);
    // The way out is on the Crypt Stair, not the Ossuary: the panel lists
    // the exits of the zone you have selected, and each exit belongs to
    // exactly one zone.
    await selectZone("Crypt Stair");
    await hold(700);
    segment.beat("MOVE: back up to the nave");
    await click(page, moveTo("Nave"));
    await hold(2200);
    await selectZone("The Crossing");
    await hold(700);
    segment.beat("MOVE: return to the crypt");
    await click(page, moveTo("Crypt"));
    await hold(2200);
    await selectZone("Ossuary");
    await hold(700);
    await frame(page, page.getByRole("heading", { name: "Hazard" }), { at: 0.42 });
    await hold(1200);
    await beatSay(page, segment, "Come back next session and it is still gone. The room remembered.", 4200);

    // --- The bell chamber brings its own battle map ---
    await say(page, null);
    await badge(page, "The Bell Chamber");
    await selectZone("Crypt Stair");
    await hold(700);
    await click(page, moveTo("Nave"));
    await hold(2000);
    // The bell stair is off the choir stalls.
    await selectZone("Choir Stalls");
    await hold(700);
    segment.beat("MOVE: up the bell stair");
    await click(page, moveTo("Bell Chamber"));
    await hold(2000);
    await click(page, page.getByRole("button", { name: "Show Battle Grid" }));
    await expect(page.locator(".grid-map-svg")).toBeVisible();
    await frame(page, page.locator(".grid-map-svg > g[transform]").first(), { at: 0.5 });
    await hold(1200);
    await beatSay(page, segment, "A room can carry its own battle map, and it loads the moment they walk in.", 3800);

    await say(page, null);
    await badge(page, null);
    await hold(700);
  } finally {
    await view.finish();
    segment.write();
  }
});

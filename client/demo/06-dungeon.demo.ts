import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage, armEncounter, resetDungeonRooms } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, type, frame } from "./demoKit";

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
    // Unzoomed, same as the combat segment: this is a map screen, and the
    // map screens now get the wide content measure. Zooming would shrink the
    // effective viewport back below the width the zone map can use.
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

    // The group, not its circle: the pointer handler is on the <g>, and a
    // click on the circle alone did not open the panel.
    const zoneNode = (name: string) => page.locator(".zone-map-svg .zone-node").filter({ hasText: name }).first();
    // Selecting a zone opens its panel; clicking the circle can land before
    // React has re-rendered the selection when the machine is busy encoding
    // the previous segment's video. Click until the panel is actually there.
    // noScroll: the zone map handles the wheel itself to zoom, so scrolling
    // toward a node pushes it away instead of bringing it into view.
    // Closes whatever panel is open before selecting, so "the panel is open"
    // is a signal about *this* zone. Left open, clickUntil returned on the
    // previous zone's panel without ever selecting the new one — and the
    // panel lists only the selected zone's exits, so the next Move Party
    // button was for a door that wasn't there.
    const selectZone = async (name: string) => {
      // Retries the whole close-scroll-click sequence, not just the click.
      // Closing the panel changes the page height, which moves the map while
      // the frame loop is measuring it.
      //
      // The scroll here is a plain DOM scrollIntoView rather than the kit's
      // wheel-based frame(): the wheel loop is nicer on camera but converges
      // by measurement, and this runs right after a layout change. One
      // deterministic call beats a loop that can be chasing a moving target.
      const close = page.getByRole("button", { name: "Close", exact: true });
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await close.count() > 0) await click(page, close.first(), { settle: 320 });
        await hold(250);
        await page.evaluate(() => document.querySelector(".zone-map-svg")?.scrollIntoView({ block: "center" }));
        await hold(350);
        await click(page, zoneNode(name), { noScroll: true, settle: 400 });
        try {
          await close.first().waitFor({ state: "visible", timeout: 3000 });
          return;
        } catch {
          await hold(400);
        }
      }
      throw new Error(`selectZone: the panel never opened for "${name}"`);
    };

    // Scrolls the map back into frame. The zone panel renders below the
    // canvas, so every beat that reads the panel — and every Move Party
    // button, which lives in it — leaves the map above the viewport.
    //
    // This looked for a long time like the map losing its pan on room load.
    // It is not: the <g> transform reads translate(0 0) scale(1) in every
    // room. A node at a negative viewport y looks the same whether the page
    // scrolled or the map panned, and it was the page every time.
    const recentreMap = () => frame(page, page.locator(".zone-map-svg > g[transform]").first(), { at: 0.42 });

    // Jumping to a room through the Load Dungeon picker rather than walking
    // an exit. It calls the same loadRoom underneath — the leave still
    // reports what it observed and the room still remembers it — but it
    // avoids selecting a zone in a room whose panel is already open, which
    // is unreliable enough to have cost this segment several takes.
    const jumpToRoom = async (room: string) => {
      await click(page, page.getByRole("button", { name: "Load Dungeon" }));
      await type(page, page.getByPlaceholder("Search dungeons…"), "Sunken");
      await hold(700);
      await click(page, page.locator("button.entity-item").filter({ hasText: "Sunken Abbey" }).first());
      await hold(800);
      await click(page, page.locator("button.entity-item").filter({ hasText: room }).first());
      await hold(2000);
      await recentreMap();
    };

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
    await recentreMap();
    await beatSay(page, segment, "Walk them through it — the room loads, and so does its map.", 3000);

    // --- Into the crypt, which is trapped ---
    //
    // Every transition goes through the Load Dungeon picker rather than a
    // zone's Move Party button. Both call the same loadRoom underneath, so
    // the leave still reports what it observed and the room still remembers
    // it — but selecting a zone in a room arrived at via Move Party proved
    // unreliable in a way selecting one after a picker load never is, and
    // this segment's claim is the memory, not the doorway.
    await say(page, null);
    segment.beat("MOVE: into the nave");
    await jumpToRoom("The Nave");
    segment.beat("MOVE: down into the crypt");
    await jumpToRoom("The Crypt");

    // The proof has to be on screen, not implied: select the trapped zone
    // and frame its Hazard panel, because that panel is the only place the
    // room's memory is visible.
    await selectZone("Ossuary");
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
    segment.beat("MOVE: back up to the nave");
    await jumpToRoom("The Nave");
    segment.beat("MOVE: return to the crypt");
    await jumpToRoom("The Crypt");
    await selectZone("Ossuary");
    await frame(page, page.getByRole("heading", { name: "Hazard" }), { at: 0.42 });
    await hold(1200);
    await beatSay(page, segment, "Come back next session and it is still gone. The room remembered.", 4200);

    // --- The bell chamber brings its own battle map ---
    await say(page, null);
    await badge(page, "The Bell Chamber");
    segment.beat("MOVE: up the bell stair");
    await jumpToRoom("The Bell Chamber");
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

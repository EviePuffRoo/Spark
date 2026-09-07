import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, paintRun, cellPoint, frame } from "./demoKit";

// Segment 2 — building the map you fight on.
//
// The map opened here is seeded deliberately unfinished: walls, grass, trees,
// a game trail. Watching a room get blocked out tile by tile is three minutes
// of nothing; what earns screen time is the handful of decisions the tileset
// makes interesting, so the shot starts where those begin.
//
// Three of them, in order:
//   - a chasm stamped with a negative elevation, which is what lets a flying
//     creature cross it later;
//   - a bridge over that chasm, which is a *span* — it lays across the ground
//     instead of replacing it, so the chasm still draws either side of the
//     deck and comes back if the bridge is erased;
//   - a fence painted rotated, because a fence running north-south is a
//     different piece of art from the same fence running east-west.
//
// The map is saved at the end, which means re-running this segment paints
// over its own previous take. That is fine and intended: the combat segment
// is shot on a different map ("The Drowned Bell"), so nothing downstream
// depends on how this one ends up.
const CELL = 32;

test("segment 2 — building a battle map", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("02-map-builder");

  const view = await openView(browser, {
    name: "dm",
    segment,
    signIn: { username: demo.dm.username, password: demo.password },
    storage: demoStorage(demo),
    // The canvas is 20x14 cells at a fixed 32px each — barely a third of a
    // 1920 frame at 1:1. Zoomed, the map is the shot.
    zoom: 1.4,
  });
  const { page } = view;

  try {
    const rail = page.locator("nav.nav-rail");
    const side = page.locator("nav.area-sidebar");
    await expect(rail).toBeVisible();
    await hold(700);

    await badge(page, "Map Builder");
    await click(page, rail.locator('button:has-text("Play")'));
    await click(page, side.locator('button:has-text("Map Builder")'));
    await expect(page.getByRole("heading", { name: "Map Builder", exact: true })).toBeVisible();
    await beatSay(page, segment, "Battle maps are hand-built from a fixed tileset. No uploads.", 2800);

    await say(page, null);
    await click(page, page.locator("li.tavern-row").filter({ hasText: "Chasm Crossing" }));

    const svg = page.locator(".map-builder-svg");
    await expect(svg).toBeVisible();
    await hold(800);

    // Framed once, here and nowhere else. Everything after this only ever
    // scrolls the palette, which has its own overflow (max-height: 75vh in
    // App.css) — so the map itself never moves again for the rest of the
    // segment.
    await frame(page, svg, { at: 0.5 });
    await hold(900);
    await beatSay(page, segment, "Fifty-eight tiles. Every one carries its own rules.", 2600);

    const swatch = (name: string) => page.locator(`.tile-swatch-button[title="${name}"]`);
    const elevation = page.getByRole("spinbutton", { name: "Elevation (ft)" });

    // --- A chasm, and the height that makes it a hole rather than a wall ---
    await say(page, null);
    await click(page, swatch("Chasm"));
    await click(page, elevation, { settle: 120 });
    await elevation.fill("-30");
    await hold(500);
    segment.beat("PAINT: the chasm");
    await paintRun(page, svg, [[9, 1], [9, 2], [9, 3], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10], [9, 11], [9, 12]], CELL);
    await paintRun(page, svg, [[10, 12], [10, 11], [10, 10], [10, 9], [10, 8], [10, 7], [10, 6], [10, 5], [10, 4], [10, 3], [10, 2], [10, 1]], CELL);
    await beatSay(page, segment, "A chasm, thirty feet down — so a flying creature can cross it and nobody else can.", 3400);

    // --- The span layer ---
    await say(page, null);
    await elevation.fill("0");
    await click(page, swatch("Bridge"));
    await hold(400);
    segment.beat("PAINT: the bridge across it");
    await paintRun(page, svg, [[9, 6], [10, 6]], CELL);
    await paintRun(page, svg, [[9, 7], [10, 7]], CELL);
    await hold(900);
    await beatSay(page, segment, "The bridge lays across the chasm rather than replacing it — look under the deck.", 3600);

    // --- Rotation ---
    await say(page, null);
    await click(page, swatch("Wooden Fence"));
    await hold(300);
    segment.beat("PAINT: fence, unrotated");
    await paintRun(page, svg, [[14, 3], [14, 4], [14, 5]], CELL);
    await beatSay(page, segment, "A fence, painted downwards — but the art still runs across.", 3000);

    await say(page, null);
    await click(page, page.locator('.tile-rotation-button[title="Paint rotated 90°"]'));
    await hold(500);
    segment.beat("PAINT: fence, rotated 90°");
    await paintRun(page, svg, [[14, 3], [14, 4], [14, 5], [14, 6]], CELL);
    await beatSay(page, segment, "Turn the brush, and it runs the way you're drawing it.", 3200);

    // --- What the map does for itself ---
    await say(page, null);
    await click(page, page.locator('.tile-rotation-button[title="Paint rotated 0°"]'));
    await click(page, swatch("Torch Sconce"));
    segment.beat("PAINT: torches");
    await paintRun(page, svg, [[5, 6]], CELL);
    await paintRun(page, svg, [[13, 9]], CELL);
    await hold(400);
    await click(page, swatch("Stone Wall"));
    segment.beat("PAINT: a wall, for the shading to catch");
    await paintRun(page, svg, [[4, 9], [5, 9], [6, 9], [7, 9]], CELL);
    await hold(900);

    // Sit on the finished map for a moment: the shadows, the seams and the
    // bridge deck are all derived from the tiles already placed, so this
    // frame is the argument for the whole visual layer.
    const centreCell = await cellPoint(svg, 10, 7, CELL);
    await page.mouse.move(centreCell.x, centreCell.y, { steps: 20 });
    await beatSay(page, segment, "Light, shadow and seams are all worked out from the tiles themselves.", 3600);

    await say(page, null);
    segment.beat("CLICK: Save");
    await click(page, page.getByRole("button", { name: /^Save/ }));
    await hold(1800);

    await badge(page, null);
    await hold(600);
  } finally {
    await view.finish();
    segment.write();
  }
});

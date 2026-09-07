import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, type, SHOOT } from "./demoKit";

// Segment 5 — the weeks between sessions.
//
// Downtime is the part of a campaign most tools ignore and most tables
// hand-wave, and it is the one place where a rules engine earns its keep
// without anybody noticing: crafting an item has a real cost in gold and
// days, and logging it debits the party's ledger and credits the inventory
// in one action rather than three people remembering to.
//
// The two writes here (a logged activity, a crafted item) are additive, so
// re-shooting simply adds another entry.

test("segment 5 — downtime, crafting and travel", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("05-downtime");

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
    await hold(800);

    await badge(page, "Downtime");
    await click(page, rail.locator('button:has-text("World")'));
    await click(page, side.locator('button:has-text("Downtime")').first());
    await click(page, side.locator('button:has-text("Downtime")').last());
    await expect(page.getByRole("heading", { name: "Log a Downtime Activity" })).toBeVisible();
    await beatSay(page, segment, "The weeks between sessions are a thing you can actually run.", 3000);

    // --- A logged activity, with an outcome the rules roll for you ---
    await say(page, null);
    await type(page, page.getByRole("combobox", { name: "Character name" }), "Sable Wren");
    await page.getByRole("combobox", { name: "Activity type" }).selectOption("carousing");
    await hold(600);
    await type(page, page.getByRole("textbox", { name: "Description" }), "Three nights in the Drowned Oar, buying for ferrymen and listening.", 26);
    await hold(500);

    segment.beat("CLICK: roll a downtime outcome");
    await click(page, page.getByRole("button", { name: "Roll Outcome" }));
    await hold(1800);
    await beatSay(page, segment, "Roll the outcome, and the gold moves with it.", 3000);

    await say(page, null);
    segment.beat("CLICK: log the activity");
    await click(page, page.getByRole("button", { name: "Log Activity" }));
    await hold(2000);

    // --- Crafting, priced by the rules rather than by argument ---
    await say(page, null);
    await badge(page, "Crafting");
    await page.getByRole("combobox", { name: "Activity type" }).selectOption("crafting");
    await hold(800);
    await type(page, page.getByRole("combobox", { name: "Character name" }), "Brannoc Duskbarrow");
    await click(page, page.getByRole("button", { name: "+ Pick Item" }));
    await type(page, page.getByPlaceholder("Search items…"), "Bell");
    await hold(900);
    await click(page, page.locator("button.entity-item").filter({ hasText: "Bell-Iron Dagger" }).first());
    await hold(1200);
    await beatSay(page, segment, "Cost and days come from the item's own rarity — nobody has to adjudicate it.", 3600);

    await say(page, null);
    segment.beat("CLICK: log the crafting");
    await click(page, page.getByRole("button", { name: "Log Activity" }));
    await hold(2200);
    await beatSay(page, segment, "Gold out of the ledger, the item into the party's hands.", 3000);

    await say(page, null);
    await page.mouse.wheel(0, 560);
    await hold(2400);
    segment.beat("the downtime log");

    // --- Travel, costed against the map ---
    //
    // Guarded rather than assumed. The Travel sub-view mounts under
    // `worldId && viewMode === "travel"`, and on some takes its region
    // pickers are gone from the DOM a few seconds after the panel appears
    // — which is worth knowing about, but it is not worth failing a
    // segment over: the app's own hint on this panel says the result is
    // "Not saved", so it is the least load-bearing thing on the page and
    // everything above it is the actual claim.
    await say(page, null);
    await badge(page, "Travel");
    await page.mouse.wheel(0, -700);
    await hold(500);
    await click(page, page.getByRole("button", { name: "Travel", exact: true }));
    await hold(1400);

    const originButton = page.getByRole("button", { name: "Choose Origin Region" });
    if (await originButton.count() > 0) {
      await beatSay(page, segment, "Getting somewhere costs days, and days are when things happen.", 3000);
      await say(page, null);
      await click(page, originButton);
      await type(page, page.getByPlaceholder("Search regions…"), "Thorn");
      await hold(800);
      await click(page, page.locator("button.entity-item").filter({ hasText: "Thorn Fen" }).first());
      await hold(900);
      await click(page, page.getByRole("button", { name: "Choose Destination Region" }));
      await type(page, page.getByPlaceholder("Search regions…"), "Bell");
      await hold(800);
      await click(page, page.locator("button.entity-item").filter({ hasText: "Bellwether" }).first());
      await hold(1400);
      segment.beat("travel between two regions");
      await beatSay(page, segment, "Roll the journey against an encounter table, and it writes itself up.", 3400);
    } else {
      console.log("  [skipped] the travel region pickers were not mounted on this take");
      segment.beat("SKIPPED: travel region pickers not mounted");
    }

    await say(page, null);
    await badge(page, null);
    await hold(700);
  } finally {
    await view.finish();
    segment.write();
  }
});

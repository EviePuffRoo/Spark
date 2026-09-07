import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, type, SHOOT } from "./demoKit";

// Segment 4 — the half of a campaign that isn't a fight.
//
// Combat is what a VTT is judged on and it is not what most of a campaign
// is. This segment covers the between-sessions surface: the town the party
// keeps coming back to, buying against a shared purse rather than four
// separate character sheets, and the tavern hub that answers "what were we
// doing?" without anyone reading back through their notes.
//
// It reads the seeded world rather than building anything, so it is safe to
// re-shoot at any point — the one write it makes (a purchase) is additive
// and shows up in the ledger, which is the point of the beat.

test("segment 4 — the town, the shop and the tavern", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("04-town");

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

    // --- The places, as records rather than prose ---
    await badge(page, "The World");
    await click(page, rail.locator('button:has-text("World")'));
    await click(page, side.locator('button:has-text("Records")'));
    await click(page, side.locator('button:has-text("Roster")'));
    await expect(page.locator(".entity-list").first()).toBeVisible();

    // .roster-mode-tabs specifically: the area sidebar is itself a
    // .grouped-tabs, and it comes first in the DOM.
    const rosterTab = (name: string) => page.locator(".roster-mode-tabs").getByRole("tab", { name, exact: true });
    await click(page, rosterTab("World"));
    await click(page, rosterTab("Settlements"));
    await hold(700);
    await click(page, page.locator(".entity-list li").filter({ hasText: "Wickmoor" }).first());
    await beatSay(page, segment, "Towns, regions, factions — every one a record you can open at the table.", 3000);
    await hold(1600);

    // --- Buying against the party's purse ---
    await say(page, null);
    await badge(page, "The Shop");
    await click(page, rail.locator('button:has-text("Play")'));
    await click(page, side.locator('button:has-text("Shop")'));
    await expect(page.getByRole("heading", { name: "Shop", exact: true })).toBeVisible();
    await hold(900);
    await beatSay(page, segment, "A shop is stock and a price list, and it spends the party's shared gold.", 3000);

    await say(page, null);
    const holyWater = page.locator(".shop-stock-row").filter({ hasText: "Holy Water" });
    await expect(holyWater).toBeVisible();
    await type(page, holyWater.getByRole("spinbutton", { name: /Quantity for/ }), "1");
    segment.beat("CLICK: buy from the shop");
    await click(page, holyWater.getByRole("button", { name: "Buy", exact: true }));
    await hold(1600);
    await beatSay(page, segment, "One purse, not four character sheets.", 2600);

    // --- Which lands in the ledger, with a name against it ---
    await say(page, null);
    await badge(page, "The Party's Purse");
    await click(page, side.locator('button:has-text("Inventory")'));
    await expect(page.getByRole("heading", { name: "Party Inventory" })).toBeVisible();
    await hold(1000);
    await beatSay(page, segment, "Everything the party owns, and who spent what.", 2800);
    await page.mouse.wheel(0, 520);
    await hold(2200);
    await page.mouse.wheel(0, 520);
    await hold(2000);

    // --- The hub they come back to ---
    await say(page, null);
    await badge(page, "The Tavern");
    await click(page, rail.locator('button:has-text("World")'));
    await click(page, side.locator('button:has-text("Downtime")'));
    await click(page, side.locator('button:has-text("Tavern")'));
    await expect(page.getByRole("heading", { name: "The Tavern" })).toBeVisible();
    await hold(1200);
    await beatSay(page, segment, "Between sessions: what's on the board, and who owes who.", 3000);

    await say(page, null);
    await page.mouse.wheel(0, 480);
    await hold(2400);
    segment.beat("faction standings");
    await beatSay(page, segment, "Standings move when the party acts, and the table can see them.", 3200);
    await say(page, null);
    await page.mouse.wheel(0, 520);
    await hold(2600);
    segment.beat("the party's base");
    await beatSay(page, segment, "And the place they call theirs, if they've bought one.", 2800);

    await say(page, null);
    await badge(page, null);
    await hold(700);
  } finally {
    await view.finish();
    segment.write();
  }
});

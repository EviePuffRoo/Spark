import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, SHOOT } from "./demoKit";

// Segment 7 — the world moving while the party isn't looking.
//
// The last claim, and the one that separates a campaign manager from a
// notes app: time passes, and the world does something with it. Advance the
// calendar and the app proposes what changed — factions pursuing agendas,
// shops restocking, clocks ticking — as a list the DM approves or rejects
// item by item rather than a fait accompli.
//
// That review step is the whole design. It is the DM's world; the
// simulation's job is to have opinions, not authority. So the shot spends
// its time on the proposal list and on unchecking something, not on the
// button that produced it.
//
// This segment writes to the world (the day advances, approved changes
// apply). Re-shooting therefore moves it further along, which is fine —
// nothing else reads the calendar.

test("segment 7 — advancing the world", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("07-world-tick");

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

    await badge(page, "The Calendar");
    await click(page, rail.locator('button:has-text("World")'));
    await click(page, side.locator('button:has-text("Campaign")'));
    await click(page, side.locator('button:has-text("Overview")'));
    await expect(page.getByRole("heading", { name: demo.worldName })).toBeVisible();
    await hold(900);
    await beatSay(page, segment, "A campaign has a calendar, and the party spent days on that downtime.", 3200);

    // --- Move the clock ---
    await say(page, null);
    const advance = page.getByRole("button", { name: /\+1 Day|Advance/ }).first();
    await expect(advance).toBeVisible();
    segment.beat("CLICK: advance the calendar");
    await click(page, advance);
    await hold(1600);

    // --- And ask the world what it did with them ---
    await badge(page, "The World Tick");
    const simulate = page.getByRole("button", { name: "Simulate World" });
    await expect(simulate).toBeVisible();
    await beatSay(page, segment, "Then ask what happened while nobody was watching.", 2800);
    await say(page, null);
    segment.beat("CLICK: simulate the world");
    await click(page, simulate);
    await hold(2600);

    await beatSay(page, segment, "Factions move, stock turns over, clocks fill — as a proposal, not a fact.", 3600);
    await say(page, null);
    await page.mouse.wheel(0, 420);
    await hold(2400);

    // --- The DM has the last word, item by item ---
    const firstCheckbox = page.locator(".world-tick-item input[type='checkbox'], .save-panel input[type='checkbox']").first();
    if (await firstCheckbox.count() > 0 && await firstCheckbox.isVisible()) {
      segment.beat("UNCHECK: reject one proposed change");
      await click(page, firstCheckbox);
      await hold(1400);
      await beatSay(page, segment, "Anything you don't want, you uncheck. It's your world.", 3200);
      await say(page, null);
    }

    const apply = page.getByRole("button", { name: /^Apply \d+ Change/ });
    if (await apply.count() > 0) {
      segment.beat("CLICK: apply the rest");
      await click(page, apply.first());
      await hold(2400);
      await beatSay(page, segment, "Applied — and every one of them is in the campaign log.", 3000);
      await say(page, null);
    }

    await page.mouse.wheel(0, 520);
    await hold(2600);
    segment.beat("the world after the tick");

    await say(page, null);
    await badge(page, null);
    await hold(700);
  } finally {
    await view.finish();
    segment.write();
  }
});

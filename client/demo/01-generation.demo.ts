import { test, expect } from "@playwright/test";
import { loadDemoWorld, demoStorage } from "./demoWorld";
import { Segment, openView, badge, beatSay, say, click, hold, glide, SHOOT } from "./demoKit";

// Segment 1 — where a campaign comes from.
//
// The claim this footage has to land is that the prep side is not a set of
// empty forms: a world already full of people, places and factions, and a
// generator that fills a stat block in the time it takes to click a button.
// Generation runs locally (no model call, no spinner worth filming), which is
// itself the point — so the shot is paced to the app, not to a progress bar.
//
// Nothing later depends on what gets generated here. The generators use
// Math.random, so a re-shoot produces different names; every other segment
// reads the seeded cast instead, and this one is free to be re-recorded.

test("segment 1 — generating a world and its cast", async ({ browser }) => {
  const demo = loadDemoWorld();
  const segment = new Segment("01-generation");

  const view = await openView(browser, {
    name: "dm",
    segment,
    signIn: { username: demo.dm.username, password: demo.password },
    storage: demoStorage(demo, { "spark-create-type": "npc" }),
    ...SHOOT,
  });
  const { page } = view;

  try {
    const rail = page.locator("nav.nav-rail");
    const side = page.locator("nav.area-sidebar");
    await expect(rail).toBeVisible();
    await hold(900);

    // --- The world already exists, and is full ---
    await badge(page, "World");
    await click(page, rail.locator('button:has-text("World")'));
    await click(page, side.locator('button:has-text("Campaign")'));
    await click(page, side.locator('button:has-text("Overview")'));
    // By heading, not by text: the world's name is also an <option> in the
    // header's world picker, which is hidden and matches first in DOM order.
    await expect(page.getByRole("heading", { name: demo.worldName })).toBeVisible();
    await beatSay(page, segment, "Everything for a campaign lives in one world.", 2400);

    await glide(page, page.locator(".page").first());
    await page.mouse.wheel(0, 520);
    await hold(1400);
    await page.mouse.wheel(0, 520);
    await hold(1600);
    await page.mouse.wheel(0, -1040);
    await hold(700);

    // --- The roster: the cast that is already in it ---
    await click(page, side.locator('button:has-text("Records")'));
    await click(page, side.locator('button:has-text("Roster")'));
    await expect(page.locator(".entity-list").first()).toBeVisible();
    await beatSay(page, segment, "Its cast, its places, its factions — all in one roster.", 2600);
    await page.mouse.wheel(0, 420);
    await hold(1500);
    await page.mouse.wheel(0, -420);
    await hold(600);

    // --- Generating a monster ---
    await badge(page, "Generate");
    await click(page, rail.locator('button:has-text("Prep")'));
    await click(page, side.locator('button:has-text("Create")'));
    const createTab = (name: string) => page.locator(".create-type-tabs").getByRole("tab", { name, exact: true });
    // Each forge names its own verb ("Generate", "Draft Quest Hook",
    // "Sketch Location"), and the forges that have a Generate/Create Your Own
    // mode toggle put a second button called "Generate" above the form. The
    // primary inside the generator layout is the one that runs it, whatever
    // it happens to be called.
    const runGenerator = page.locator(".generator-layout .btn-primary").first();
    await click(page, createTab("Characters"));
    await click(page, createTab("NPCs & Monsters"));
    await expect(runGenerator).toBeVisible();
    await beatSay(page, segment, "Need something the world hasn't got yet?", 2200);

    await click(page, page.getByRole("combobox", { name: "Type" }));
    await page.getByRole("combobox", { name: "Type" }).selectOption("monster");
    await hold(500);
    await page.getByRole("combobox", { name: "Challenge Rating" }).selectOption("3");
    await hold(700);

    await say(page, null);
    segment.beat("CLICK: Generate a monster");
    await click(page, runGenerator, { settle: 200 });
    await expect(page.locator(".statblock").first()).toBeVisible({ timeout: 15_000 });
    await beatSay(page, segment, "A full stat block — attacks, saves, senses, the lot.", 2800);

    await page.mouse.wheel(0, 450);
    await hold(2000);
    await page.mouse.wheel(0, 450);
    await hold(2000);
    await page.mouse.wheel(0, -900);
    await hold(600);

    segment.beat("CLICK: Save to Roster");
    await click(page, page.getByRole("button", { name: "Save to Roster" }));
    await expect(page.getByText("Saved it to roster.")).toBeVisible();
    await beatSay(page, segment, "Saved into the world, ready to drop into a fight.", 2400);

    // --- The same button, for the rest of a campaign ---
    await click(page, createTab("Story"));
    await click(page, createTab("Quests"));
    await hold(600);
    segment.beat("CLICK: Generate a quest");
    await click(page, runGenerator, { settle: 200 });
    await expect(page.getByRole("button", { name: "Save to Roster" })).toBeVisible({ timeout: 15_000 });
    await beatSay(page, segment, "Quests, factions, shops, regions, whole dungeons — same click.", 3000);
    await hold(1200);

    await click(page, createTab("World"));
    await click(page, createTab("Locations"));
    await hold(500);
    segment.beat("CLICK: Generate a location");
    await click(page, runGenerator, { settle: 200 });
    await hold(2600);

    await say(page, null);
    await badge(page, null);
    await hold(700);
  } finally {
    await view.finish();
    segment.write();
  }
});

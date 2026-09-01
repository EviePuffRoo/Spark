import { test, expect } from "@playwright/test";

// Formalizes the ad hoc signup -> create world -> generate & save an entity
// -> log out flow used to manually smoke-test features throughout this
// project — the template for future e2e specs.
test("signup, create a world, generate and save an NPC, log out", async ({ page }) => {
  const username = `e2euser${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.locator('form button[type="submit"]').click();

  // Signup lands on the one-time recovery-code screen first.
  await page.getByRole("button", { name: "I've saved it, continue" }).click();

  // Fresh accounts land on a mandatory onboarding screen before the nav renders.
  await page.getByRole("button", { name: "Start from a blank slate" }).click();
  await expect(page.locator("nav.nav-rail")).toBeVisible();

  // Create a world.
  await page.locator('nav.nav-rail button:has-text("World")').click();
  await page.locator('nav.area-sidebar button:has-text("Worlds")').click();
  await page.getByLabel("New world name").fill("Playwright Test World");
  await page.getByRole("button", { name: "Create World" }).click();
  await expect(page.getByRole("listitem").getByText("Playwright Test World")).toBeVisible();

  // Generate and save an NPC to the Roster.
  await page.locator('nav.nav-rail button:has-text("Prep")').click();
  await page.locator('nav.area-sidebar button:has-text("Create")').click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator(".statblock").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Save to Roster" }).click();
  await expect(page.getByText("Saved it to roster.")).toBeVisible();

  // Confirm it actually landed in the Roster. World's sidebar groups its
  // subtabs (Campaign/Records/Downtime) — Roster lives under Records.
  await page.locator('nav.nav-rail button:has-text("World")').click();
  await page.locator('nav.area-sidebar button:has-text("Records")').click();
  await page.locator('nav.area-sidebar button:has-text("Roster")').click();
  await expect(page.locator(".entity-list")).toBeVisible();

  // Log out via the Account area's Profile page.
  await page.locator('nav.nav-rail button:has-text("Account")').click();
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page.getByRole("button", { name: "Log In" }).first()).toBeVisible();
});

import { test, expect, type Page } from "@playwright/test";

// Characterization coverage for the live combat screen (InitiativeTracker).
// This is the app's most-used surface and had no UI coverage at all — these
// tests pin its current observable behavior so a refactor of the component
// has something to fail against. They deliberately assert on what a DM at
// the table would see (HP text, round number, whose turn it is, panels
// opening and applying their effect) rather than on internal structure, so
// they survive the component being reorganized.
//
// Dice rolls are random, so anything downstream of a roll is asserted as a
// direction of change (HP went down) or as "the result was announced",
// never as an exact number.

test.describe.configure({ mode: "serial" });

async function signupAndOpenCombat(page: Page, username: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "I've saved it, continue" }).click();
  await page.getByRole("button", { name: "Start from a blank slate" }).click();
  await expect(page.locator("nav.nav-rail")).toBeVisible();

  await page.locator('nav.nav-rail button:has-text("Play")').click();
  await page.locator('nav.area-sidebar button:has-text("Combat")').click();
  await expect(page.locator(".initiative-tracker")).toBeVisible();
}

async function addCombatant(page: Page, name: string, initiative: number, maxHp: number, ac: number) {
  await page.getByRole("button", { name: "+ Add Custom" }).click();
  await page.getByPlaceholder("e.g. Aria (PC)").fill(name);
  const numbers = page.locator(".initiative-tracker input[type='number']");
  await numbers.nth(0).fill(String(initiative)); // Initiative
  await numbers.nth(1).fill(String(maxHp));      // Max HP
  await numbers.nth(2).fill(String(ac));         // AC
  await page.getByRole("button", { name: "Add Combatant" }).click();
  await expect(page.locator(".combatant-name", { hasText: name })).toBeVisible();
}

// The row for a named combatant, so per-combatant controls stay unambiguous
// when several combatants are on screen.
function rowFor(page: Page, name: string) {
  return page.locator(".combatant-row").filter({ has: page.locator(".combatant-name", { hasText: name }) });
}

async function hpTextFor(page: Page, name: string) {
  return (await rowFor(page, name).locator(".combatant-hp-value").innerText()).trim();
}

test("tracks initiative order, HP, conditions and rounds", async ({ page }) => {
  await signupAndOpenCombat(page, `combat${Date.now()}`);

  await addCombatant(page, "Kestrel Vane", 18, 44, 17);
  await addCombatant(page, "Charred Revenant", 12, 67, 15);

  // --- Initiative order: highest first. ---
  const names = await page.locator(".combatant-row .combatant-name").allInnerTexts();
  expect(names).toEqual(["Kestrel Vane", "Charred Revenant"]);

  // --- Starting HP. ---
  expect(await hpTextFor(page, "Kestrel Vane")).toBe("44 / 44 HP");
  expect(await hpTextFor(page, "Charred Revenant")).toBe("67 / 67 HP");

  // --- Damage. ---
  const revenant = rowFor(page, "Charred Revenant");
  await revenant.locator(".combatant-hp-input").fill("12");
  await revenant.getByRole("button", { name: "Damage" }).click();
  await expect(revenant.locator(".combatant-hp-value")).toHaveText("55 / 67 HP");

  // --- Heal. ---
  await revenant.locator(".combatant-hp-input").fill("5");
  await revenant.getByRole("button", { name: "Heal" }).click();
  await expect(revenant.locator(".combatant-hp-value")).toHaveText("60 / 67 HP");

  // --- Healing never exceeds max. ---
  await revenant.locator(".combatant-hp-input").fill("999");
  await revenant.getByRole("button", { name: "Heal" }).click();
  await expect(revenant.locator(".combatant-hp-value")).toHaveText("67 / 67 HP");

  // --- A combatant at 0 HP is marked down. ---
  await revenant.locator(".combatant-hp-input").fill("100");
  await revenant.getByRole("button", { name: "Damage" }).click();
  await expect(revenant.locator(".combatant-hp-value")).toHaveText("0 / 67 HP");
  await expect(revenant).toHaveClass(/down/);

  // Back up for the rest of the test.
  await revenant.locator(".combatant-hp-input").fill("67");
  await revenant.getByRole("button", { name: "Heal" }).click();
  await expect(revenant).not.toHaveClass(/down/);

  // --- Conditions: add, show, and remove. ---
  // Asserted via the applied chip, not the container — the container also
  // holds the open picker, which lists every condition name by definition.
  await revenant.getByRole("button", { name: "+ Condition" }).click();
  await revenant.getByRole("button", { name: "Poisoned", exact: true }).click();
  await expect(revenant.locator(".condition-chip", { hasText: "Poisoned" })).toBeVisible();

  await revenant.getByRole("button", { name: "Remove Poisoned from Charred Revenant" }).click();
  await expect(revenant.locator(".condition-chip", { hasText: "Poisoned" })).toHaveCount(0);

  // Close the picker so it doesn't overlay the controls used below.
  await revenant.getByRole("button", { name: "+ Condition" }).click();

  // --- Rounds and turn order. ---
  await expect(page.locator(".round-banner")).toHaveText("Round 1");
  const first = page.locator(".combatant-row").first();
  await expect(first).toHaveClass(/active-turn/);

  await page.getByRole("button", { name: "Next Turn" }).click();
  await expect(page.locator(".combatant-row").nth(1)).toHaveClass(/active-turn/);
  await expect(page.locator(".round-banner")).toHaveText("Round 1");

  // Wrapping past the last combatant advances the round.
  await page.getByRole("button", { name: "Next Turn" }).click();
  await expect(page.locator(".combatant-row").first()).toHaveClass(/active-turn/);
  await expect(page.locator(".round-banner")).toHaveText("Round 2");

  // --- Removing a combatant. ---
  await revenant.getByRole("button", { name: "Remove Charred Revenant" }).click();
  await expect(page.locator(".combatant-row")).toHaveCount(1);
});

test("resolves an attack and applies its damage to the target", async ({ page }) => {
  await signupAndOpenCombat(page, `attack${Date.now()}`);

  await addCombatant(page, "Kestrel Vane", 18, 44, 10);
  await addCombatant(page, "Practice Dummy", 1, 50, 1); // AC 1 so the attack always hits

  const attacker = rowFor(page, "Kestrel Vane");
  await attacker.getByRole("button", { name: "⚔ Attack" }).click();

  const panel = attacker.locator(".attack-panel");
  await expect(panel).toBeVisible();

  // Target defaults to the only other combatant.
  await expect(panel.locator("select").first()).toHaveValue(/.+/);

  await panel.getByLabel("To-hit bonus").fill("5");
  await panel.getByRole("button", { name: "Roll to Hit" }).click();

  // The roll is announced, and against AC 1 it hits.
  const rollResult = panel.locator(".encounter-roll-result").first();
  await expect(rollResult).toBeVisible();
  await expect(rollResult).toContainText("HIT");

  // Damage applies to the target, not the attacker.
  const before = await hpTextFor(page, "Practice Dummy");
  expect(before).toBe("50 / 50 HP");

  await panel.getByLabel("Damage dice").fill("2d6+3");
  await panel.getByRole("button", { name: "Roll Damage & Apply" }).click();
  await expect(panel.getByText(/Applied \d+ damage/)).toBeVisible();

  const after = await hpTextFor(page, "Practice Dummy");
  const remaining = Number(after.split("/")[0].trim());
  expect(remaining).toBeGreaterThanOrEqual(50 - 15); // 2d6+3 caps at 15
  expect(remaining).toBeLessThan(50);
  expect(await hpTextFor(page, "Kestrel Vane")).toBe("44 / 44 HP");

  // Advantage/disadvantage are selectable and reflected in the UI.
  await panel.getByRole("tab", { name: "Advantage", exact: true }).click();
  await expect(panel.getByRole("tab", { name: "Advantage", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("tab", { name: "Normal", exact: true })).toHaveAttribute("aria-selected", "false");
});

test("clears the encounter", async ({ page }) => {
  await signupAndOpenCombat(page, `clear${Date.now()}`);
  await addCombatant(page, "Temporary Goblin", 10, 7, 13);
  await expect(page.locator(".combatant-row")).toHaveCount(1);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear Encounter" }).click();
  await expect(page.locator(".combatant-row")).toHaveCount(0);
});

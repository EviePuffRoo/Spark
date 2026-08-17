import { describe, it, expect } from "vitest";
import { generateCharacter } from "./index.js";
import type { AbilityKey } from "../types.js";

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function expectValidStatBlock(statBlock: ReturnType<typeof generateCharacter>["statBlock"]) {
  expect(statBlock.armorClass).toBeGreaterThan(0);
  expect(statBlock.hitPointsAverage).toBeGreaterThan(0);
  expect(statBlock.proficiencyBonus).toBeGreaterThanOrEqual(2);
  expect(statBlock.xp).toBeGreaterThanOrEqual(0);
  for (const key of ABILITY_KEYS) {
    expect(typeof statBlock.abilityScores[key]).toBe("number");
    expect(statBlock.abilityScores[key]).toBeGreaterThan(0);
  }
}

describe("generateCharacter", () => {
  it("generates a complete NPC with a race, background, and valid stat block", () => {
    const char = generateCharacter({ kind: "npc" });
    expect(char.kind).toBe("npc");
    expect(char.name.trim().length).toBeGreaterThan(0);
    expect(char.race).toBeTruthy();
    expect(char.templateId).toBeTruthy();
    expect(char.templateName).toBeTruthy();
    expect(char.backstory.occupationOrRole).toBeTruthy();
    expectValidStatBlock(char.statBlock);
  });

  it("generates a complete monster with no race field and a valid stat block", () => {
    const char = generateCharacter({ kind: "monster" });
    expect(char.kind).toBe("monster");
    expect(char.race).toBeUndefined();
    expect(char.templateId).toBeTruthy();
    expectValidStatBlock(char.statBlock);
  });

  it("honors an explicit templateId request", () => {
    const first = generateCharacter({ kind: "npc" });
    const char = generateCharacter({ kind: "npc", templateId: first.templateId });
    expect(char.templateId).toBe(first.templateId);
  });

  it("honors an explicit alignment request", () => {
    const char = generateCharacter({ kind: "npc", alignment: "Lawful Good" });
    expect(char.alignment).toBe("Lawful Good");
    expect(char.statBlock.alignment).toBe("Lawful Good");
  });

  it("honors an explicit name request", () => {
    const char = generateCharacter({ kind: "npc", name: "Sir Reginald" });
    expect(char.name).toBe("Sir Reginald");
  });

  it("produces varied output across repeated calls (not hardcoded to one template)", () => {
    const templateIds = new Set(Array.from({ length: 20 }, () => generateCharacter({ kind: "npc" }).templateId));
    expect(templateIds.size).toBeGreaterThan(1);
  });
});

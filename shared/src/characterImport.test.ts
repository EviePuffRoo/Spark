import { describe, it, expect } from "vitest";
import { parseCharacterText } from "./characterImport.js";

describe("parseCharacterText", () => {
  it("parses a simple colon-labeled stat block", () => {
    const text = [
      "Name: Elowen Brightblade",
      "Class: Ranger",
      "Level: 5",
      "Race: Wood Elf",
      "Armor Class: 15",
      "Hit Points: 42",
      "STR: 14",
      "DEX: 18",
      "CON: 13",
      "INT: 10",
      "WIS: 16",
      "CHA: 8",
      "Player: Alex",
    ].join("\n");

    const { draft, matchedFields } = parseCharacterText(text);

    expect(draft.name).toBe("Elowen Brightblade");
    expect(draft.className).toBe("Ranger");
    expect(draft.level).toBe(5);
    expect(draft.race).toBe("Wood Elf");
    expect(draft.armorClass).toBe(15);
    expect(draft.maxHp).toBe(42);
    expect(draft.abilityScores).toEqual({ str: 14, dex: 18, con: 13, int: 10, wis: 16, cha: 8 });
    expect(draft.playerName).toBe("Alex");
    expect(matchedFields).toContain("abilityScores");
  });

  it("parses a D&D Beyond-style combined class-and-level line without colons", () => {
    const text = ["Class & Level", "Fighter 5", "Race", "Human", "Armor Class", "16"].join("\n");
    const { draft } = parseCharacterText(text);
    expect(draft.className).toBe("Fighter");
    expect(draft.level).toBe(5);
    expect(draft.race).toBe("Human");
    expect(draft.armorClass).toBe(16);
  });

  it("falls back to the next line when a label has no value on its own line", () => {
    const text = ["STRENGTH", "16 (+3)"].join("\n");
    const { draft } = parseCharacterText(text);
    expect(draft.abilityScores.str).toBe(16);
  });

  it("does not treat a word that merely starts with a label as a match", () => {
    const text = ["Strongbox: empty", "STR: 12"].join("\n");
    const { draft } = parseCharacterText(text);
    expect(draft.abilityScores.str).toBe(12);
  });

  it("keeps multiclass text intact instead of mangling it into a bad split", () => {
    const text = ["Class & Level", "Fighter 3 / Wizard 2"].join("\n");
    const { draft, matchedFields } = parseCharacterText(text);
    expect(draft.className).toBe("Fighter 3 / Wizard 2");
    expect(matchedFields).toContain("className");
    expect(matchedFields).not.toContain("level");
  });

  it("leaves unmatched fields at their defaults and reports nothing matched", () => {
    const { draft, matchedFields } = parseCharacterText("just some random notes\nwith no recognizable labels");
    expect(draft.name).toBe("");
    expect(draft.abilityScores).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    expect(matchedFields).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { abilityModifier, formatModifier } from "./math.js";
import { getRuleset, dnd5eRuleset } from "../index.js";

describe("abilityModifier", () => {
  it("matches the standard 5e table at both ends and around 10", () => {
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(20)).toBe(5);
    expect(abilityModifier(30)).toBe(10);
  });
});

describe("formatModifier", () => {
  it("always shows a sign, including +0", () => {
    expect(formatModifier(10)).toBe("+0");
    expect(formatModifier(11)).toBe("+0");
    expect(formatModifier(14)).toBe("+2");
    expect(formatModifier(8)).toBe("-1");
  });
});

describe("getRuleset", () => {
  it("defaults to dnd5e with no id, and falls back to dnd5e for an unknown id", () => {
    expect(getRuleset()).toBe(dnd5eRuleset);
    expect(getRuleset("dnd5e")).toBe(dnd5eRuleset);
    expect(getRuleset("some-future-system")).toBe(dnd5eRuleset);
  });
});

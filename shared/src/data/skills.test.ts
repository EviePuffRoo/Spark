import { describe, it, expect } from "vitest";
import { pointBuyCost, pointBuyTotalCost, POINT_BUY_BUDGET, CLASS_SKILL_CHOICES, SKILLS } from "./skills.js";

describe("point buy", () => {
  it("costs nothing for the baseline 8 in every ability", () => {
    expect(pointBuyTotalCost({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(0);
  });

  it("matches the standard 5e cost table at a few known points", () => {
    expect(pointBuyCost(10)).toBe(2);
    expect(pointBuyCost(13)).toBe(5);
    expect(pointBuyCost(15)).toBe(9);
  });

  it("a single maxed-out ability (15) plus five baseline abilities stays under budget", () => {
    expect(pointBuyTotalCost({ str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBeLessThanOrEqual(POINT_BUY_BUDGET);
  });

  it("every ability maxed at 15 exceeds the 27-point budget", () => {
    expect(pointBuyTotalCost({ str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 })).toBeGreaterThan(POINT_BUY_BUDGET);
  });

  it("a score above 15 costs Infinity — not purchasable via point buy", () => {
    expect(pointBuyCost(16)).toBe(Infinity);
  });
});

describe("class skill choices", () => {
  it("every choice list only references real skill names", () => {
    const names = new Set(SKILLS.map((s) => s.name));
    for (const { choices } of Object.values(CLASS_SKILL_CHOICES)) {
      for (const c of choices) expect(names.has(c)).toBe(true);
    }
  });

  it("Bard can choose from every skill (the SRD's 'any three' rule)", () => {
    expect(CLASS_SKILL_CHOICES.bard.choices.length).toBe(SKILLS.length);
  });
});

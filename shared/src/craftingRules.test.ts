import { describe, it, expect } from "vitest";
import { computeCraftingCost } from "./craftingRules.js";

describe("computeCraftingCost", () => {
  it("charges half the item's value and a day per 25gp, minimum one day", () => {
    expect(computeCraftingCost({ value: 100 })).toEqual({ goldCost: 50, daysRequired: 4 });
  });

  it("rounds up fractional gold and days", () => {
    expect(computeCraftingCost({ value: 10 })).toEqual({ goldCost: 5, daysRequired: 1 });
    expect(computeCraftingCost({ value: 51 })).toEqual({ goldCost: 26, daysRequired: 3 });
  });

  it("floors negative or zero value at zero cost with a minimum of one day", () => {
    expect(computeCraftingCost({ value: 0 })).toEqual({ goldCost: 0, daysRequired: 1 });
    expect(computeCraftingCost({ value: -5 })).toEqual({ goldCost: 0, daysRequired: 1 });
  });
});

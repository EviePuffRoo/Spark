import { describe, it, expect } from "vitest";
import { isHostilePair, leftReach } from "./opportunityAttack.js";

describe("isHostilePair", () => {
  it("is true for a playerCharacter vs a monster", () => {
    expect(isHostilePair({ kind: "playerCharacter" }, { kind: "monster" })).toBe(true);
  });
  it("is true for a playerCharacter vs a custom entry", () => {
    expect(isHostilePair({ kind: "playerCharacter" }, { kind: "custom" })).toBe(true);
  });
  it("is false for two monsters", () => {
    expect(isHostilePair({ kind: "monster" }, { kind: "monster" })).toBe(false);
  });
  it("is false for two player characters", () => {
    expect(isHostilePair({ kind: "playerCharacter" }, { kind: "playerCharacter" })).toBe(false);
  });
});

describe("leftReach", () => {
  it("is true when adjacent before the move and not after", () => {
    expect(leftReach({ x: 1, y: 1 }, { x: 5, y: 5 }, 2, 2)).toBe(true);
  });
  it("is false when never adjacent to begin with", () => {
    expect(leftReach({ x: 5, y: 5 }, { x: 9, y: 9 }, 0, 0)).toBe(false);
  });
  it("is false when still adjacent after the move", () => {
    expect(leftReach({ x: 1, y: 1 }, { x: 1, y: 2 }, 2, 2)).toBe(false);
  });
  it("counts diagonal adjacency (Chebyshev, not Manhattan)", () => {
    expect(leftReach({ x: 0, y: 0 }, { x: 5, y: 5 }, 1, 1)).toBe(true);
  });
});

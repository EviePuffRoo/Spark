import { describe, it, expect } from "vitest";
import { computeConcentrationDc } from "./concentration.js";

describe("computeConcentrationDc", () => {
  it("floors at DC 10 for small or no damage", () => {
    expect(computeConcentrationDc(0)).toBe(10);
    expect(computeConcentrationDc(10)).toBe(10);
    expect(computeConcentrationDc(19)).toBe(10);
  });

  it("uses half the damage (rounded down) once it exceeds 20", () => {
    expect(computeConcentrationDc(20)).toBe(10);
    expect(computeConcentrationDc(21)).toBe(10);
    expect(computeConcentrationDc(22)).toBe(11);
    expect(computeConcentrationDc(30)).toBe(15);
  });
});

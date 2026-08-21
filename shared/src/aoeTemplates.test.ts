import { describe, it, expect } from "vitest";
import { computeAoeCells, footprintCells, footprintIntersectsTemplate, type AoeTemplate } from "./aoeTemplates.js";

const MAP = { width: 20, height: 20 };

describe("computeAoeCells", () => {
  it("circle: includes the origin and every cell within radius, excludes cells beyond it", () => {
    const template: AoeTemplate = { kind: "circle", originX: 10, originY: 10, targetX: 13, targetY: 10 };
    const cells = computeAoeCells(MAP, template);
    expect(cells.has("10,10")).toBe(true);
    expect(cells.has("13,10")).toBe(true);
    expect(cells.has("12,10")).toBe(true);
    expect(cells.has("14,10")).toBe(false);
    expect(cells.has("17,10")).toBe(false);
  });

  it("circle: is roughly symmetric in all directions", () => {
    const template: AoeTemplate = { kind: "circle", originX: 10, originY: 10, targetX: 10, targetY: 14 };
    const cells = computeAoeCells(MAP, template);
    expect(cells.has("10,14")).toBe(true);
    expect(cells.has("10,6")).toBe(true);
    expect(cells.has("14,10")).toBe(true);
    expect(cells.has("6,10")).toBe(true);
  });

  it("square: forms a centered box sized by the click distance, rounded", () => {
    const template: AoeTemplate = { kind: "square", originX: 10, originY: 10, targetX: 12, targetY: 10 };
    const cells = computeAoeCells(MAP, template);
    // half = round(2) = 2, so a 5x5 box from (8,8) to (12,12)
    expect(cells.has("8,8")).toBe(true);
    expect(cells.has("12,12")).toBe(true);
    expect(cells.has("10,10")).toBe(true);
    expect(cells.has("13,10")).toBe(false);
    expect(cells.has("7,8")).toBe(false);
  });

  it("cone: includes cells within length and within the angular spread toward the aim point, excludes cells behind the origin", () => {
    const template: AoeTemplate = { kind: "cone", originX: 10, originY: 10, targetX: 14, targetY: 10 };
    const cells = computeAoeCells(MAP, template);
    expect(cells.has("10,10")).toBe(true);
    expect(cells.has("13,10")).toBe(true);
    expect(cells.has("11,11")).toBe(true); // within ~45 degrees of due-east
    expect(cells.has("6,10")).toBe(false); // directly behind the origin
    expect(cells.has("10,14")).toBe(false); // perpendicular to the aim, out of the cone
    expect(cells.has("18,10")).toBe(false); // beyond the cone's length
  });

  it("line: includes a corridor of cells along the aim direction, excludes cells off to the side", () => {
    const template: AoeTemplate = { kind: "line", originX: 5, originY: 5, targetX: 5, targetY: 10 };
    const cells = computeAoeCells(MAP, template);
    expect(cells.has("5,5")).toBe(true);
    expect(cells.has("5,8")).toBe(true);
    expect(cells.has("5,10")).toBe(true);
    expect(cells.has("5,12")).toBe(false); // beyond the line's length
    expect(cells.has("8,7")).toBe(false); // off to the side
  });

  it("collapses to just the origin cell when the two click points coincide", () => {
    const template: AoeTemplate = { kind: "circle", originX: 3, originY: 3, targetX: 3, targetY: 3 };
    const cells = computeAoeCells(MAP, template);
    expect(cells.size).toBe(1);
    expect(cells.has("3,3")).toBe(true);
  });

  it("clips cells to the map bounds", () => {
    const template: AoeTemplate = { kind: "circle", originX: 1, originY: 1, targetX: 5, targetY: 1 };
    const cells = computeAoeCells({ width: 3, height: 3 }, template);
    for (const c of cells) {
      const [x, y] = c.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
      expect(y).toBeLessThan(3);
    }
  });
});

describe("footprintCells / footprintIntersectsTemplate", () => {
  it("a size-1 creature occupies exactly its own cell", () => {
    expect(footprintCells(4, 4, 1)).toEqual(["4,4"]);
  });

  it("a large (size-2) creature occupies its full 2x2 footprint", () => {
    const cells = footprintCells(4, 4, 2);
    expect(cells.sort()).toEqual(["4,4", "4,5", "5,4", "5,5"].sort());
  });

  it("intersects when any occupied cell overlaps the template, not just the anchor cell", () => {
    const templateCells = new Set(["5,5"]);
    expect(footprintIntersectsTemplate(4, 4, 2, templateCells)).toBe(true);
    expect(footprintIntersectsTemplate(4, 4, 1, templateCells)).toBe(false);
  });
});

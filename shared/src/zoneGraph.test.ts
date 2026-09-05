import { describe, it, expect } from "vitest";
import { areZonesAdjacent, zoneDistances } from "./zoneGraph.js";

const node = (id: string, connections: string[] = []) => ({ id, connections });

describe("areZonesAdjacent", () => {
  it("counts a link listed from either side", () => {
    expect(areZonesAdjacent([node("a", ["b"]), node("b")], "a", "b")).toBe(true);
    expect(areZonesAdjacent([node("a"), node("b", ["a"])], "a", "b")).toBe(true);
    expect(areZonesAdjacent([node("a", ["b"]), node("b", ["a"])], "a", "b")).toBe(true);
  });

  it("is false for unlinked or unknown zones", () => {
    expect(areZonesAdjacent([node("a"), node("b")], "a", "b")).toBe(false);
    expect(areZonesAdjacent([node("a", ["b"]), node("b")], "a", "gone")).toBe(false);
    expect(areZonesAdjacent([], "a", "b")).toBe(false);
  });

  it("does not treat a two-hop path as adjacency", () => {
    const zones = [node("a", ["b"]), node("b", ["c"]), node("c")];
    expect(areZonesAdjacent(zones, "a", "c")).toBe(false);
  });
});

describe("zoneDistances", () => {
  it("counts hops outward from the origin", () => {
    const zones = [node("a", ["b"]), node("b", ["c"]), node("c", ["d"]), node("d")];
    const d = zoneDistances(zones, "a");
    expect(d.get("a")).toBe(0);
    expect(d.get("b")).toBe(1);
    expect(d.get("c")).toBe(2);
    expect(d.get("d")).toBe(3);
  });

  it("traverses a one-sided link in both directions", () => {
    // Same tolerance as areZonesAdjacent: the stored form may be one-sided.
    const zones = [node("a"), node("b", ["a"])];
    expect(zoneDistances(zones, "a").get("b")).toBe(1);
  });

  it("omits anything unreachable", () => {
    const zones = [node("a", ["b"]), node("b"), node("island")];
    expect(zoneDistances(zones, "a").has("island")).toBe(false);
  });

  it("takes the shortest of two routes", () => {
    const zones = [node("a", ["b", "long1"]), node("b", ["target"]), node("long1", ["long2"]), node("long2", ["target"]), node("target")];
    expect(zoneDistances(zones, "a").get("target")).toBe(2);
  });
});

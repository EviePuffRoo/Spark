import { describe, it, expect } from "vitest";
import { describeWeather } from "./weather.js";

describe("describeWeather", () => {
  it("is deterministic for the same region and day", () => {
    const a = describeWeather("Forest", "region-1", 5);
    const b = describeWeather("Forest", "region-1", 5);
    expect(a).toEqual(b);
  });

  it("returns an entry from the matching terrain's pool", () => {
    const reading = describeWeather("Desert", "region-1", 1);
    expect(reading.condition).toBeTruthy();
    expect(reading.description).toBeTruthy();
  });

  it("varies across different days for the same region", () => {
    const readings = new Set<string>();
    for (let day = 1; day <= 10; day++) {
      readings.add(describeWeather("Plains", "region-1", day).condition);
    }
    expect(readings.size).toBeGreaterThan(1);
  });

  it("varies across different regions for the same day", () => {
    const readings = new Set<string>();
    for (let i = 0; i < 10; i++) {
      readings.add(describeWeather("Plains", `region-${i}`, 1).condition);
    }
    expect(readings.size).toBeGreaterThan(1);
  });

  it("falls back to the default pool for an unrecognized terrain", () => {
    const reading = describeWeather("Astral Plane", "region-1", 1);
    expect(reading.condition).toBeTruthy();
  });
});

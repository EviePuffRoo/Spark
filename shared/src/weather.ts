import { WEATHER_BY_TERRAIN, type WeatherEntry } from "./data/weather.js";

export type WeatherReading = WeatherEntry;

// FNV-1a — deterministic and fast. Used to pick a stable weather entry per
// region-per-day, so the reading never changes on refetch but still varies
// day to day and region to region without needing a database table.
function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function describeWeather(terrainCategory: string, regionId: string, day: number): WeatherReading {
  const pool = WEATHER_BY_TERRAIN[terrainCategory] ?? WEATHER_BY_TERRAIN.default;
  const seed = hashSeed(`${regionId}:${Math.trunc(day)}`);
  return pool[seed % pool.length];
}

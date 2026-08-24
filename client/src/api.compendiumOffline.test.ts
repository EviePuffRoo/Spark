import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";
import type { CompendiumData } from "./api";

const SAMPLE: CompendiumData = {
  spells: [], conditions: [], rules: [], monsters: [], magicItems: [],
};

describe("api.getCompendium offline fallback", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = vi.fn();
    // Each test starts with an empty cache, regardless of run order or
    // what a previous test wrote under the same "compendium" key.
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("spark-offline-cache");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("caches a successful response and reports it as not offline", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
    });

    const result = await api.getCompendium();
    expect(result.offline).toBe(false);
    expect(result.cachedAt).toBeNull();
    expect(result.data).toEqual(SAMPLE);
  });

  it("falls back to the cached copy when the network request fails, and marks it offline", async () => {
    // First call succeeds and populates the cache.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
    });
    await api.getCompendium();

    // Second call fails outright (e.g. offline) — should serve the cached copy.
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await api.getCompendium();
    expect(result.offline).toBe(true);
    expect(result.data).toEqual(SAMPLE);
    expect(typeof result.cachedAt).toBe("string");
  });

  it("rethrows the original error when the network fails and there's no cached copy", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.getCompendium()).rejects.toThrow("Failed to fetch");
  });
});

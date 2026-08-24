import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { getCached, putCached } from "./offlineCache";

describe("offlineCache", () => {
  it("returns null for a key that was never cached", async () => {
    expect(await getCached("never-written")).toBeNull();
  });

  it("round-trips a value written with putCached", async () => {
    await putCached("spells", { foo: "bar", count: 3 });
    const result = await getCached<{ foo: string; count: number }>("spells");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ foo: "bar", count: 3 });
    expect(typeof result!.cachedAt).toBe("string");
    expect(new Date(result!.cachedAt).getTime()).not.toBeNaN();
  });

  it("overwrites a previously cached value under the same key", async () => {
    await putCached("overwrite-me", { version: 1 });
    await putCached("overwrite-me", { version: 2 });
    const result = await getCached<{ version: number }>("overwrite-me");
    expect(result!.data).toEqual({ version: 2 });
  });

  it("keeps separate keys independent", async () => {
    await putCached("key-a", "a-value");
    await putCached("key-b", "b-value");
    expect((await getCached<string>("key-a"))!.data).toBe("a-value");
    expect((await getCached<string>("key-b"))!.data).toBe("b-value");
  });
});

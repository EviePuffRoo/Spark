import { describe, it, expect, vi } from "vitest";
import { publishWorldChange, subscribeToWorld, publishTokenMoved, subscribeToTokenMoved } from "../src/worldEvents.js";

describe("worldEvents pub/sub", () => {
  it("delivers a published change only to listeners on the same worldId", () => {
    const heardA = vi.fn();
    const heardB = vi.fn();
    const unsubA = subscribeToWorld("world-a", heardA);
    const unsubB = subscribeToWorld("world-b", heardB);

    publishWorldChange("world-a", "encounter");

    expect(heardA).toHaveBeenCalledWith("encounter");
    expect(heardB).not.toHaveBeenCalled();

    unsubA();
    unsubB();
  });

  it("stops delivering to a listener after it unsubscribes", () => {
    const heard = vi.fn();
    const unsub = subscribeToWorld("world-c", heard);
    unsub();
    publishWorldChange("world-c", "chat");
    expect(heard).not.toHaveBeenCalled();
  });

  it("delivers a token-moved payload only to tokenMoved listeners, not change listeners", () => {
    const changeHeard = vi.fn();
    const tokenHeard = vi.fn();
    const unsubChange = subscribeToWorld("world-d", changeHeard);
    const unsubToken = subscribeToTokenMoved("world-d", tokenHeard);

    publishTokenMoved("world-d", { combatantId: "c1", gridX: 3, gridY: 4, hidden: false });

    expect(tokenHeard).toHaveBeenCalledWith({ combatantId: "c1", gridX: 3, gridY: 4, hidden: false });
    expect(changeHeard).not.toHaveBeenCalled();

    unsubChange();
    unsubToken();
  });

  it("keeps the shared per-world emitter alive as long as either event type still has a listener", () => {
    const changeHeard = vi.fn();
    const tokenHeard = vi.fn();
    const unsubChange = subscribeToWorld("world-e", changeHeard);
    const unsubToken = subscribeToTokenMoved("world-e", tokenHeard);

    // Unsubscribing the change listener alone must not tear down the
    // shared emitter while a tokenMoved listener is still registered.
    unsubChange();
    publishTokenMoved("world-e", { combatantId: "c2", gridX: 0, gridY: 0, hidden: false });
    expect(tokenHeard).toHaveBeenCalledTimes(1);

    unsubToken();
    // Now both are gone — a further publish should reach nobody (and
    // shouldn't throw even though the underlying emitter was cleaned up).
    expect(() => publishTokenMoved("world-e", { combatantId: "c2", gridX: 1, gridY: 1, hidden: false })).not.toThrow();
    expect(tokenHeard).toHaveBeenCalledTimes(1);
  });
});

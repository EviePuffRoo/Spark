import { describe, it, expect } from "vitest";
import { computeWorldTickProposal, type WorldTickInput } from "./worldTick.js";

function baseInput(overrides: Partial<WorldTickInput> = {}): WorldTickInput {
  return {
    worldId: "world-1",
    fromDay: 1,
    toDay: 15,
    factions: [],
    relationships: [],
    characters: [],
    shops: [],
    ...overrides,
  };
}

describe("computeWorldTickProposal", () => {
  it("proposes nothing when no time has elapsed", () => {
    const result = computeWorldTickProposal(baseInput({ toDay: 1 }));
    expect(result.items).toEqual([]);
  });

  it("proposes nothing for a neutral or rival relationship", () => {
    const result = computeWorldTickProposal(baseInput({
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "neutral" }],
    }));
    expect(result.items).toEqual([]);
  });

  it("proposes negative reputation deltas for both factions in a war", () => {
    const result = computeWorldTickProposal(baseInput({
      factions: [{ id: "a", name: "Thieves Guild", hiddenFromParty: false }, { id: "b", name: "City Watch", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "war" }],
    }));
    const repItems = result.items.filter((i) => i.kind === "factionReputation");
    expect(repItems).toHaveLength(2);
    for (const item of repItems) {
      expect(item.delta).toBeLessThan(0);
    }
  });

  it("proposes positive reputation deltas for both factions in an alliance", () => {
    const result = computeWorldTickProposal(baseInput({
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "ally" }],
    }));
    const repItems = result.items.filter((i) => i.kind === "factionReputation");
    expect(repItems).toHaveLength(2);
    for (const item of repItems) {
      expect(item.delta).toBeGreaterThan(0);
    }
  });

  it("proposes a flavor campaign event once at least 3 days have elapsed", () => {
    const input = baseInput({
      toDay: 4,
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "war" }],
    });
    const short = computeWorldTickProposal({ ...input, toDay: 2 });
    expect(short.items.some((i) => i.kind === "campaignEvent")).toBe(false);

    const long = computeWorldTickProposal(input);
    expect(long.items.some((i) => i.kind === "campaignEvent")).toBe(true);
  });

  it("drifts a faction-affiliated character's disposition to follow their faction's trend", () => {
    const result = computeWorldTickProposal(baseInput({
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "war" }],
      characters: [{ id: "c1", name: "Grix", factionId: "a", hiddenFromParty: false }],
    }));
    const dispositionItem = result.items.find((i) => i.kind === "characterDisposition" && i.characterId === "c1");
    expect(dispositionItem).toBeDefined();
    expect(dispositionItem!.delta).toBeLessThan(0);
  });

  it("skips a hidden character and a character with no faction", () => {
    const result = computeWorldTickProposal(baseInput({
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "war" }],
      characters: [
        { id: "c1", name: "Hidden", factionId: "a", hiddenFromParty: true },
        { id: "c2", name: "Unaffiliated", factionId: undefined, hiddenFromParty: false },
      ],
    }));
    expect(result.items.some((i) => i.kind === "characterDisposition")).toBe(false);
  });

  it("is deterministic: the same input always produces the same proposal", () => {
    const input = baseInput({
      factions: [{ id: "a", name: "A", hiddenFromParty: false }, { id: "b", name: "B", hiddenFromParty: false }],
      relationships: [{ id: "r1", factionAId: "a", factionBId: "b", stance: "war" }],
      characters: [{ id: "c1", name: "Grix", factionId: "a", hiddenFromParty: false }],
      shops: [{ id: "s1", name: "The Rusty Kettle", stock: [{ id: "e1", itemId: "i1", itemName: "Rope", price: 10, quantity: 5 }] }],
    });
    const first = computeWorldTickProposal(input);
    const second = computeWorldTickProposal(input);
    expect(second).toEqual(first);
  });

  it("only fluctuates a fraction of shop stock entries, and gives each a nonzero, itemized delta", () => {
    const stock = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, itemId: `i${i}`, itemName: `Item ${i}`, price: 20, quantity: 5 }));
    const result = computeWorldTickProposal(baseInput({ shops: [{ id: "s1", name: "Shop", stock }] }));
    const shopItems = result.items.filter((i) => i.kind === "shopStock");
    expect(shopItems.length).toBeGreaterThan(0);
    expect(shopItems.length).toBeLessThan(stock.length);
    for (const item of shopItems) {
      expect(item.delta).not.toBe(0);
    }
  });
});

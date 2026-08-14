import { describe, it, expect } from "vitest";
import { layoutDungeonRooms } from "./dungeonLayout.js";

interface TestRoom {
  id: string;
  exits: { toRoomId: string }[];
}

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("layoutDungeonRooms", () => {
  it("returns an empty array for no rooms", () => {
    expect(layoutDungeonRooms([])).toEqual([]);
  });

  it("places every room exactly once, each with a rect", () => {
    const rooms: TestRoom[] = [
      { id: "a", exits: [{ toRoomId: "b" }] },
      { id: "b", exits: [{ toRoomId: "a" }, { toRoomId: "c" }] },
      { id: "c", exits: [{ toRoomId: "b" }] },
    ];
    const laid = layoutDungeonRooms(rooms);
    expect(laid.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
    for (const room of laid) {
      expect(room.rect.width).toBeGreaterThan(0);
      expect(room.rect.height).toBeGreaterThan(0);
    }
  });

  it("never overlaps any two rooms, including disconnected components", () => {
    // Two disconnected clusters plus an isolated room with no exits at all.
    const rooms: TestRoom[] = [
      { id: "a1", exits: [{ toRoomId: "a2" }] },
      { id: "a2", exits: [{ toRoomId: "a1" }, { toRoomId: "a3" }] },
      { id: "a3", exits: [{ toRoomId: "a2" }] },
      { id: "b1", exits: [{ toRoomId: "b2" }] },
      { id: "b2", exits: [{ toRoomId: "b1" }] },
      { id: "isolated", exits: [] },
    ];
    const laid = layoutDungeonRooms(rooms);
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        expect(rectsOverlap(laid[i].rect, laid[j].rect)).toBe(false);
      }
    }
  });

  it("ignores an exit referencing a room id that isn't in the list", () => {
    const rooms: TestRoom[] = [
      { id: "a", exits: [{ toRoomId: "nonexistent" }] },
    ];
    const laid = layoutDungeonRooms(rooms);
    expect(laid).toHaveLength(1);
    expect(laid[0].rect).toBeDefined();
  });

  it("does not mutate the input array", () => {
    const rooms: TestRoom[] = [{ id: "a", exits: [] }];
    const snapshot = JSON.stringify(rooms);
    layoutDungeonRooms(rooms);
    expect(JSON.stringify(rooms)).toBe(snapshot);
  });

  it("preserves each room's own fields alongside the added rect", () => {
    const rooms = [{ id: "a", exits: [], name: "Throne Room" }];
    const laid = layoutDungeonRooms(rooms);
    expect(laid[0].name).toBe("Throne Room");
  });
});

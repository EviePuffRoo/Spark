import type { DungeonRoomRect } from "../types.js";

const CELL = 140;
const ROOM_SIZE_MIN = 80;
const ROOM_SIZE_JITTER = 36;
const ALIGNMENT_TOLERANCE = 20;
const COMPONENT_GAP_CELLS = 3;

interface GridCell {
  gx: number;
  gy: number;
}

const CARDINAL_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Finds the closest unoccupied grid cell to (gx,gy): first the 4 cardinal
// neighbors (random order), then widening rings outward. At the room
// counts this app generates (<=12), a ring search beyond radius 1 is rare.
function findFreeCellNear(gx: number, gy: number, occupied: Set<string>): GridCell {
  for (const [dx, dy] of shuffled(CARDINAL_DIRS)) {
    const key = `${gx + dx},${gy + dy}`;
    if (!occupied.has(key)) return { gx: gx + dx, gy: gy + dy };
  }
  for (let radius = 2; radius < 64; radius++) {
    const ring: GridCell[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) ring.push({ gx: gx + dx, gy: gy + dy });
      }
    }
    for (const cell of shuffled(ring)) {
      if (!occupied.has(`${cell.gx},${cell.gy}`)) return cell;
    }
  }
  // Practically unreachable at this app's room-count ceiling, but keeps
  // the function total instead of throwing.
  let fallbackRadius = 64;
  while (occupied.has(`${gx + fallbackRadius},${gy}`)) fallbackRadius++;
  return { gx: gx + fallbackRadius, gy };
}

// Places every room in a spatial grid via BFS over the exit graph, so
// connected rooms land in adjacent cells. Each room is inscribed with
// margin inside its own CELL x CELL cell, so no two rooms can ever
// overlap — no collision-resolution pass is needed. Pure and duck-typed:
// works on generated outlines already reshaped to {id, exits}, saved
// Dungeon rooms, or manually-built room lists alike. Returns a new array;
// the input is never mutated.
export function layoutDungeonRooms<T extends { id: string; exits: { toRoomId: string }[] }>(
  rooms: T[],
): (T & { rect: DungeonRoomRect })[] {
  if (rooms.length === 0) return [];

  const adjacency = new Map<string, Set<string>>();
  const idSet = new Set(rooms.map((r) => r.id));
  for (const room of rooms) {
    if (!adjacency.has(room.id)) adjacency.set(room.id, new Set());
    for (const exit of room.exits) {
      if (!idSet.has(exit.toRoomId)) continue;
      adjacency.get(room.id)!.add(exit.toRoomId);
      if (!adjacency.has(exit.toRoomId)) adjacency.set(exit.toRoomId, new Set());
      adjacency.get(exit.toRoomId)!.add(room.id);
    }
  }

  const cellOf = new Map<string, GridCell>();
  const occupied = new Set<string>();
  const unvisited = new Set(rooms.map((r) => r.id));
  let nextComponentGy = 0;

  while (unvisited.size > 0) {
    const rootId = rooms.find((r) => unvisited.has(r.id))!.id;
    const origin: GridCell = { gx: 0, gy: nextComponentGy };
    cellOf.set(rootId, origin);
    occupied.add(`${origin.gx},${origin.gy}`);
    unvisited.delete(rootId);

    let maxGy = origin.gy;
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentCell = cellOf.get(currentId)!;
      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (!unvisited.has(neighborId)) continue;
        const cell = findFreeCellNear(currentCell.gx, currentCell.gy, occupied);
        cellOf.set(neighborId, cell);
        occupied.add(`${cell.gx},${cell.gy}`);
        unvisited.delete(neighborId);
        maxGy = Math.max(maxGy, cell.gy);
        queue.push(neighborId);
      }
    }
    nextComponentGy = maxGy + COMPONENT_GAP_CELLS;
  }

  return rooms.map((room) => {
    const cell = cellOf.get(room.id)!;
    const width = ROOM_SIZE_MIN + Math.floor(Math.random() * ROOM_SIZE_JITTER);
    const height = ROOM_SIZE_MIN + Math.floor(Math.random() * ROOM_SIZE_JITTER);
    const centerX = cell.gx * CELL;
    const centerY = cell.gy * CELL;
    return {
      ...room,
      rect: { x: centerX - width / 2, y: centerY - height / 2, width, height },
    };
  });
}

export interface CorridorPoint {
  x: number;
  y: number;
}

// A corridor between two rooms is a pure function of their rects, not a
// persisted/pathfound edge — recomputed live at render time (same as
// ZoneMap already draws connection lines from live x/y rather than cached
// geometry). Tree-edge corridors (the common case: every BFS parent/child
// pair from layoutDungeonRooms lands in adjacent cells) draw as a straight
// segment; a roughly-aligned pair gets one, and everything else — only
// possible for the 0-2 loop edges a dungeon can have — gets a single-bend
// elbow. This is geometry from two endpoint rects, not real pathfinding:
// an elbow can in rare unlucky layouts visually clip an intervening room.
// Accepted, same as this app's other "own convention" simplifications.
export function corridorPath(a: DungeonRoomRect, b: DungeonRoomRect): CorridorPoint[] {
  const aCenter = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const bCenter = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (Math.abs(aCenter.x - bCenter.x) < ALIGNMENT_TOLERANCE || Math.abs(aCenter.y - bCenter.y) < ALIGNMENT_TOLERANCE) {
    return [aCenter, bCenter];
  }
  return [aCenter, { x: bCenter.x, y: aCenter.y }, bCenter];
}

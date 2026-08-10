import { LOCATION_TYPES_BY_CATEGORY, LOCATION_DESCRIPTORS } from "../data/locations.js";
import { DUNGEON_HAZARDS, DUNGEON_EXIT_LABELS } from "../data/dungeons.js";
import { pick, sampleUnique, titleCase } from "./random.js";
import type { GenerateDungeonRequest, GeneratedDungeonOutline, GeneratedDungeonRoomOutline } from "../types.js";

const DEFAULT_ROOM_COUNT = 5;
const MIN_ROOM_COUNT = 2;
const MAX_ROOM_COUNT = 12;
const HAZARD_CHANCE = 0.4;

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function rollHazard() {
  const def = pick(DUNGEON_HAZARDS);
  return { label: def.label, damage: randInt(def.damageRange[0], def.damageRange[1]) };
}

export function generateDungeonOutline(request: GenerateDungeonRequest = {}): GeneratedDungeonOutline {
  const roomCount =
    request.roomCount && request.roomCount > 0
      ? Math.min(MAX_ROOM_COUNT, Math.max(MIN_ROOM_COUNT, Math.trunc(request.roomCount)))
      : DEFAULT_ROOM_COUNT;

  const dungeonRoomTypes = LOCATION_TYPES_BY_CATEGORY.dungeon;
  const name = `The ${titleCase(pick(LOCATION_DESCRIPTORS))} ${pick(dungeonRoomTypes)}`;

  // Draw distinct room names first (sampleUnique caps at the pool size),
  // then fall back to pick() — allowing repeats only once every name in
  // the pool has already been used once in this dungeon.
  const uniqueNames = sampleUnique(dungeonRoomTypes, roomCount);
  const roomNames = Array.from({ length: roomCount }, (_, i) => uniqueNames[i] ?? pick(dungeonRoomTypes));

  const rooms: GeneratedDungeonRoomOutline[] = roomNames.map((roomName) => ({
    roomId: crypto.randomUUID(),
    zoneId: crypto.randomUUID(),
    name: roomName,
    hazard: Math.random() < HAZARD_CHANCE ? rollHazard() : undefined,
    exits: [],
  }));

  function connect(fromIndex: number, toIndex: number) {
    const label = pick(DUNGEON_EXIT_LABELS);
    const from = rooms[fromIndex];
    const to = rooms[toIndex];
    if (from.exits.some((e) => e.toRoomId === to.roomId)) return;
    from.exits.push({ zoneId: from.zoneId, toRoomId: to.roomId, label });
    to.exits.push({ zoneId: to.zoneId, toRoomId: from.roomId, label });
  }

  // Connect as a randomized spanning tree (every room stays reachable),
  // then add a couple of extra edges on larger dungeons for loops.
  for (let i = 1; i < rooms.length; i++) {
    connect(i, Math.floor(Math.random() * i));
  }
  const extraEdges = rooms.length >= 4 ? Math.min(2, Math.floor(rooms.length / 4)) : 0;
  for (let i = 0; i < extraEdges; i++) {
    const from = Math.floor(Math.random() * rooms.length);
    let to = Math.floor(Math.random() * rooms.length);
    if (to === from) to = (to + 1) % rooms.length;
    connect(from, to);
  }

  return { name, rooms };
}

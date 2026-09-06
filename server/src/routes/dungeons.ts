import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { toDungeonDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";
import { parseArray, parseOptional } from "../validation.js";
import { mergeRoomState } from "@spark/shared";
import type { DungeonRoom } from "@spark/shared";

export const dungeonsRouter = Router();

// Room state is read-modify-write: fetch the rooms array, merge one room's
// state, write it back. Two of those interleaving is exactly how the sticky
// "alerted" flag went missing when this merge lived in the client — a leave
// report computed from state fetched before a flee landed wrote alerted
// back to false. Serializing per dungeon the same way withEncounterLock and
// withBaseLock do makes the merge atomic. Same caveat as those two: this is
// a single-process lock, which is what the deployment is.
const dungeonLocks = new Map<string, Promise<unknown>>();
function withDungeonLock<T>(dungeonId: string, fn: () => Promise<T>): Promise<T> {
  const prior = dungeonLocks.get(dungeonId) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  dungeonLocks.set(dungeonId, next.catch(() => {}));
  return next;
}

const dungeonExitSchema = z.object({
  zoneId: z.string(),
  toRoomId: z.string(),
  label: z.string().optional().catch(undefined),
  // Which edge of the room's battle map this exit sits on, so the grid can
  // offer the trip. zod strips unknown keys, so this has to be declared here
  // or an authored edge would be silently dropped on save.
  mapEdge: z.enum(["north", "south", "east", "west"]).optional().catch(undefined),
});

const dungeonRoomRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const dungeonRoomStateSchema = z.object({
  cleared: z.coerce.boolean(),
  alerted: z.coerce.boolean(),
  lastVisitedDay: z.number().optional().catch(undefined),
  // A partial filter (keep the string entries, drop the rest), not an
  // all-or-nothing array validation — matches the old
  // `Array.isArray(...) ? arr.filter((id) => typeof id === "string") : []`.
  disarmedHazardZoneIds: z.preprocess(
    (val) => (Array.isArray(val) ? val.filter((id) => typeof id === "string") : []),
    z.array(z.string()),
  ),
});

// A malformed nested exits/rect/state value degrades gracefully (dropped
// item, or undefined) via parseArray/parseOptional rather than failing the
// whole room — only id/name/templateId being wrong-typed drops the room
// itself, same split responsibility the old coerceRoom had.
const dungeonRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  templateId: z.string(),
  exits: z.any().optional().transform((val) => parseArray(dungeonExitSchema, val)),
  rect: z.any().optional().transform((val) => parseOptional(dungeonRoomRectSchema, val)),
  battleMapId: z.string().optional().catch(undefined),
  state: z.any().optional().transform((val) => parseOptional(dungeonRoomStateSchema, val)),
}) satisfies z.ZodType<DungeonRoom>;

dungeonsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.dungeon.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toDungeonDTO));
});

dungeonsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.dungeon.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Dungeon not found" });
  res.json(toDungeonDTO(row));
});

dungeonsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, rooms, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !Array.isArray(rooms) || rooms.length === 0) {
    return res.status(400).json({ error: "Missing required dungeon fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }
  const coercedRooms = parseArray(dungeonRoomSchema, rooms);

  const row = await prisma.dungeon.create({
    data: {
      name,
      rooms: JSON.stringify(coercedRooms),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toDungeonDTO(row));
});

// A visiting party's report about one room, merged onto whatever the room
// already remembered (see mergeRoomState in shared/). Deliberately narrow:
// the ordinary dungeon PATCH above still replaces rooms wholesale, which is
// what the editor needs and what can reset a room's alerted flag — this one
// is the live-play path, where every write is additive and no client ever
// has to read the dungeon first.
const dungeonRoomStatePatchSchema = z.object({
  cleared: z.boolean().optional(),
  alerted: z.boolean().optional(),
  lastVisitedDay: z.number().optional(),
  disarmedHazardZoneIds: z.array(z.string()).optional(),
});

dungeonsRouter.patch("/:id/rooms/:roomId/state", async (req, res) => {
  const parsed = dungeonRoomStatePatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid room state patch" });

  const result = await withDungeonLock(req.params.id, async () => {
    const existing = await prisma.dungeon.findUnique({ where: { id: req.params.id } });
    if (!(await authorizeEntityWrite(req.userId!, existing))) {
      return { error: 404 as const, message: "Dungeon not found" };
    }
    const rooms: DungeonRoom[] = parseArray(dungeonRoomSchema, JSON.parse(existing!.rooms));
    if (!rooms.some((r) => r.id === req.params.roomId)) {
      return { error: 404 as const, message: "Room not found" };
    }
    const merged = rooms.map((r) => (r.id === req.params.roomId ? { ...r, state: mergeRoomState(r.state, parsed.data) } : r));
    return prisma.dungeon.update({ where: { id: req.params.id }, data: { rooms: JSON.stringify(merged) } });
  });

  if ("error" in result) return res.status(result.error).json({ error: result.message });
  res.json(toDungeonDTO(result));
});

dungeonsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("rooms" in body) {
    const coercedRooms = parseArray(dungeonRoomSchema, body.rooms);
    data.rooms = JSON.stringify(coercedRooms);
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.dungeon.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Dungeon not found" });
  }
  const row = await prisma.dungeon.update({ where: { id: req.params.id }, data });
  res.json(toDungeonDTO(row));
});

dungeonsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.dungeon.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Dungeon not found" });
  }
  await prisma.dungeon.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("dungeon", req.params.id, req.userId!);
  res.status(204).end();
});

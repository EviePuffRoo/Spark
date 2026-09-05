import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { toDungeonDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";
import { parseArray, parseOptional } from "../validation.js";
import type { DungeonRoom } from "@spark/shared";

export const dungeonsRouter = Router();

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

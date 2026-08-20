import { Router } from "express";
import { prisma } from "../db.js";
import { toDungeonDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import type { DungeonExit, DungeonRoom, DungeonRoomRect } from "@spark/shared";

export const dungeonsRouter = Router();

function coerceExit(raw: unknown): DungeonExit | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.zoneId !== "string" || typeof e.toRoomId !== "string") return null;
  return {
    zoneId: e.zoneId,
    toRoomId: e.toRoomId,
    label: typeof e.label === "string" ? e.label : undefined,
  };
}

function coerceRect(raw: unknown): DungeonRoomRect | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.x !== "number" || typeof r.y !== "number" || typeof r.width !== "number" || typeof r.height !== "number") return undefined;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function coerceRoom(raw: unknown): DungeonRoom | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.templateId !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    templateId: r.templateId,
    exits: Array.isArray(r.exits) ? r.exits.map(coerceExit).filter((e): e is DungeonExit => e !== null) : [],
    rect: coerceRect(r.rect),
  };
}

dungeonsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.dungeon.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toDungeonDTO));
});

dungeonsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.dungeon.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
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
  const coercedRooms = rooms.map(coerceRoom).filter((r: DungeonRoom | null): r is DungeonRoom => r !== null);

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
    const coercedRooms = Array.isArray(body.rooms) ? body.rooms.map(coerceRoom).filter((r: DungeonRoom | null): r is DungeonRoom => r !== null) : [];
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

  const result = await prisma.dungeon.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Dungeon not found" });
  const row = await prisma.dungeon.findUnique({ where: { id: req.params.id } });
  res.json(toDungeonDTO(row!));
});

dungeonsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.dungeon.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Dungeon not found" });
  await deleteLinksForEntity("dungeon", req.params.id, req.userId!);
  res.status(204).end();
});

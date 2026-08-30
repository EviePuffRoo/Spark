import { Router } from "express";
import { prisma } from "../db.js";
import { toBattleMapDTO } from "../serialize.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite } from "../worldAccess.js";
import { BATTLE_MAP_MAX_WIDTH, BATTLE_MAP_MAX_HEIGHT, BATTLE_TILE_BY_ID, FREE_TIER_BATTLEMAP_LIMIT } from "@spark/shared";
import type { PlacedTile } from "@spark/shared";

export const battleMapsRouter = Router();

function coerceTile(raw: unknown, width: number, height: number): PlacedTile | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.x !== "number" || typeof t.y !== "number" || typeof t.tileId !== "string") return null;
  if (!Number.isInteger(t.x) || !Number.isInteger(t.y) || t.x < 0 || t.y < 0 || t.x >= width || t.y >= height) return null;
  if (!BATTLE_TILE_BY_ID[t.tileId]) return null;
  const layer = t.layer === "decor" || t.layer === "gmOnly" ? t.layer : undefined;
  const note = layer === "gmOnly" && typeof t.note === "string" ? t.note.slice(0, 500) : undefined;
  const elevation = typeof t.elevation === "number" && Number.isFinite(t.elevation) ? t.elevation : undefined;
  return { x: t.x, y: t.y, tileId: t.tileId, ...(layer ? { layer } : {}), ...(note ? { note } : {}), ...(elevation !== undefined ? { elevation } : {}) };
}

function coerceDimension(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) return null;
  return value;
}

battleMapsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.battleMap.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map((row) => toBattleMapDTO(row, req.userId!)));
});

battleMapsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.battleMap.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Battle map not found" });
  res.json(toBattleMapDTO(row, req.userId!));
});

battleMapsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, worldId, tags, notes, hiddenFromParty } = body;

  const width = coerceDimension(body.width, BATTLE_MAP_MAX_WIDTH);
  const height = coerceDimension(body.height, BATTLE_MAP_MAX_HEIGHT);
  if (!name || typeof name !== "string" || width === null || height === null) {
    return res.status(400).json({ error: `Missing or invalid battle map fields (width max ${BATTLE_MAP_MAX_WIDTH}, height max ${BATTLE_MAP_MAX_HEIGHT})` });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
  if (user?.tier !== "paid") {
    const mapCount = await prisma.battleMap.count({ where: { userId: req.userId } });
    if (mapCount >= FREE_TIER_BATTLEMAP_LIMIT) {
      return res.status(403).json({ error: `Free accounts are limited to ${FREE_TIER_BATTLEMAP_LIMIT} battle maps — upgrade to create more.`, code: "battlemap_limit" });
    }
  }

  const tiles = Array.isArray(body.tiles) ? body.tiles.map((t: unknown) => coerceTile(t, width, height)).filter((t: PlacedTile | null): t is PlacedTile => t !== null) : [];

  const row = await prisma.battleMap.create({
    data: {
      name,
      width,
      height,
      tiles: JSON.stringify(tiles),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toBattleMapDTO(row, req.userId!));
});

battleMapsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const existing = await prisma.battleMap.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Battle map not found" });
  }

  const data: Record<string, unknown> = {};
  for (const field of ["name", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("width" in body) {
    const width = coerceDimension(body.width, BATTLE_MAP_MAX_WIDTH);
    if (width === null) return res.status(400).json({ error: `Invalid width (max ${BATTLE_MAP_MAX_WIDTH})` });
    data.width = width;
  }
  if ("height" in body) {
    const height = coerceDimension(body.height, BATTLE_MAP_MAX_HEIGHT);
    if (height === null) return res.status(400).json({ error: `Invalid height (max ${BATTLE_MAP_MAX_HEIGHT})` });
    data.height = height;
  }
  if ("tiles" in body) {
    const width = (data.width as number | undefined) ?? existing.width;
    const height = (data.height as number | undefined) ?? existing.height;
    const tiles = Array.isArray(body.tiles) ? body.tiles.map((t: unknown) => coerceTile(t, width, height)).filter((t: PlacedTile | null): t is PlacedTile => t !== null) : [];
    data.tiles = JSON.stringify(tiles);
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const row = await prisma.battleMap.update({ where: { id: req.params.id }, data });
  res.json(toBattleMapDTO(row, req.userId!));
});

battleMapsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.battleMap.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Battle map not found" });
  }
  await prisma.battleMap.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

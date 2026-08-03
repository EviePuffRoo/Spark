import { Router } from "express";
import { prisma } from "../db.js";
import { toPlayerCharacterDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const playerCharactersRouter = Router();

playerCharactersRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.playerCharacter.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toPlayerCharacterDTO));
});

playerCharactersRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.playerCharacter.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Player character not found" });
  res.json(toPlayerCharacterDTO(row));
});

playerCharactersRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, className, level, race, armorClass, maxHp, abilityScores, playerName, worldId, tags, notes } = body;

  if (!name || !className || !level || !race || !armorClass || !maxHp) {
    return res.status(400).json({ error: "Missing required player character fields" });
  }

  const row = await prisma.playerCharacter.create({
    data: {
      name, className, level: Number(level), race, armorClass: Number(armorClass), maxHp: Number(maxHp),
      abilityScores: JSON.stringify(abilityScores ?? {}),
      playerName: playerName ?? null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toPlayerCharacterDTO(row));
});

playerCharactersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "className", "race", "playerName", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  for (const field of ["level", "armorClass", "maxHp"] as const) {
    if (field in body) data[field] = Number(body[field]);
  }
  if ("abilityScores" in body) data.abilityScores = JSON.stringify(body.abilityScores ?? {});
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.playerCharacter.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Player character not found" });
  const row = await prisma.playerCharacter.findUnique({ where: { id: req.params.id } });
  res.json(toPlayerCharacterDTO(row!));
});

playerCharactersRouter.delete("/:id", async (req, res) => {
  const result = await prisma.playerCharacter.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Player character not found" });
  await deleteLinksForEntity("playerCharacter", req.params.id, req.userId!);
  res.status(204).end();
});

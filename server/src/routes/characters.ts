import { Router } from "express";
import { prisma } from "../db.js";
import { toCharacterDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";

export const charactersRouter = Router();

charactersRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.character.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toCharacterDTO));
});

charactersRouter.get("/:id", async (req, res) => {
  const row = await prisma.character.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Character not found" });
  res.json(toCharacterDTO(row));
});

charactersRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const {
    kind, name, race, background, alignment, templateId, templateName,
    statBlock, backstory, worldId, tags, notes,
  } = body;

  if (!kind || !name || !alignment || !templateId || !templateName || !statBlock || !backstory) {
    return res.status(400).json({ error: "Missing required character fields" });
  }

  const row = await prisma.character.create({
    data: {
      kind, name, race: race ?? null, background: background ?? null, alignment,
      templateId, templateName,
      statBlock: JSON.stringify(statBlock),
      backstory: JSON.stringify(backstory),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toCharacterDTO(row));
});

charactersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "race", "background", "alignment", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if ("statBlock" in body) data.statBlock = JSON.stringify(body.statBlock);
  if ("backstory" in body) data.backstory = JSON.stringify(body.backstory);

  try {
    const row = await prisma.character.update({ where: { id: req.params.id }, data });
    res.json(toCharacterDTO(row));
  } catch {
    res.status(404).json({ error: "Character not found" });
  }
});

charactersRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.character.delete({ where: { id: req.params.id } });
    await deleteLinksForEntity("character", req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Character not found" });
  }
});

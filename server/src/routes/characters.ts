import { Router } from "express";
import { prisma } from "../db.js";
import { toCharacterDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const charactersRouter = Router();

charactersRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.character.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toCharacterDTO));
});

charactersRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.character.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
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
      userId: req.userId!,
    },
  });
  res.status(201).json(toCharacterDTO(row));
});

charactersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "race", "background", "alignment", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if ("statBlock" in body) data.statBlock = JSON.stringify(body.statBlock);
  if ("backstory" in body) data.backstory = JSON.stringify(body.backstory);

  if ("equippedItems" in body || "attunedItems" in body) {
    const equipped: string[] = Array.isArray(body.equippedItems) ? body.equippedItems : [];
    const attuned: string[] = Array.isArray(body.attunedItems) ? body.attunedItems : [];
    if (attuned.length > 3 || attuned.some((id) => !equipped.includes(id))) {
      return res.status(400).json({ error: "Attunement is limited to 3 items, and only equipped items can be attuned" });
    }
    data.equippedItems = JSON.stringify(equipped);
    data.attunedItems = JSON.stringify(attuned);
  }

  const result = await prisma.character.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Character not found" });
  const row = await prisma.character.findUnique({ where: { id: req.params.id } });
  res.json(toCharacterDTO(row!));
});

charactersRouter.delete("/:id", async (req, res) => {
  const result = await prisma.character.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Character not found" });
  await deleteLinksForEntity("character", req.params.id, req.userId!);
  res.status(204).end();
});

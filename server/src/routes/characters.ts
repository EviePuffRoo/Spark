import { Router } from "express";
import { prisma } from "../db.js";
import { toCharacterDTO, toDispositionLogEntryDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { logCampaignEventOp } from "../campaignEventLog.js";

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
    statBlock, backstory, worldId, tags, notes, hiddenFromParty,
  } = body;

  if (!kind || !name || !alignment || !templateId || !templateName || !statBlock || !backstory) {
    return res.status(400).json({ error: "Missing required character fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
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
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toCharacterDTO(row));
});

charactersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "race", "background", "alignment", "notes", "hiddenFromParty", "disposition"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("status" in body) {
    if (body.status !== "active" && body.status !== "deceased" && body.status !== "fled") {
      return res.status(400).json({ error: "status must be active, deceased, or fled" });
    }
    data.status = body.status;
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("factionId" in body) {
    if (typeof body.factionId === "string") {
      const faction = await prisma.faction.findFirst({ where: { id: body.factionId, userId: req.userId } });
      if (!faction) return res.status(403).json({ error: "You don't have access to this faction" });
    }
    data.factionId = body.factionId ?? null;
  }
  if ("settlementId" in body) {
    if (typeof body.settlementId === "string") {
      const settlement = await prisma.settlement.findFirst({ where: { id: body.settlementId, userId: req.userId } });
      if (!settlement) return res.status(403).json({ error: "You don't have access to this settlement" });
    }
    data.settlementId = body.settlementId ?? null;
  }
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

// Applies a disposition change atomically and appends an audit-log entry —
// the "smart" convenience action layered over a raw PATCH of `disposition`,
// exactly like level-up/rest are layered over PlayerCharacter's PATCH. The
// plain PATCH remains available with no side effects for hand edits.
//
// An optional `playerCharacterId` targets the change at one specific PC's
// standing instead of the NPC's general disposition: the delta is folded
// into `perPcDisposition[playerCharacterId]` rather than `disposition`, and
// the log entry records which PC it was for. Omitting it is fully
// backward-compatible with the pre-existing behavior above.
charactersRouter.post("/:id/adjust-disposition", async (req, res) => {
  const delta = typeof req.body?.delta === "number" ? Math.trunc(req.body.delta) : NaN;
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : undefined;
  const playerCharacterId = typeof req.body?.playerCharacterId === "string" ? req.body.playerCharacterId : undefined;
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: "delta must be a nonzero number" });
  }

  const row = await prisma.character.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Character not found" });

  if (playerCharacterId) {
    const pc = await prisma.playerCharacter.findFirst({ where: { id: playerCharacterId, userId: req.userId } });
    if (!pc) return res.status(403).json({ error: "You don't have access to this player character" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const authorName = user?.displayName || user?.username || "The DM";

  const characterUpdate = playerCharacterId
    ? (() => {
        const perPc: Record<string, number> = JSON.parse(row.perPcDisposition);
        perPc[playerCharacterId] = (perPc[playerCharacterId] ?? 0) + delta;
        return prisma.character.update({ where: { id: row.id }, data: { perPcDisposition: JSON.stringify(perPc) } });
      })()
    : prisma.character.update({ where: { id: row.id }, data: { disposition: { increment: delta } } });

  const [updated] = await prisma.$transaction([
    characterUpdate,
    prisma.dispositionLogEntry.create({
      data: { characterId: row.id, authorName, delta, reason: reason ?? null, playerCharacterId: playerCharacterId ?? null, userId: req.userId! },
    }),
    logCampaignEventOp({
      worldId: row.worldId,
      entityType: "disposition",
      entityId: row.id,
      eventType: playerCharacterId ? "disposition.adjustedForPc" : "disposition.adjusted",
      payload: { characterId: row.id, characterName: row.name, delta, reason, playerCharacterId },
      authorName,
      userId: req.userId!,
    }),
  ]);
  res.json(toCharacterDTO(updated));
});

charactersRouter.get("/:id/disposition-log", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.character.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Character not found" });

  const rows = await prisma.dispositionLogEntry.findMany({ where: { characterId: row.id }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(rows.map(toDispositionLogEntryDTO));
});

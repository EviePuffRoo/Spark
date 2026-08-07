import { Router } from "express";
import { prisma } from "../db.js";
import { toDowntimeActivityDTO } from "../serialize.js";
import { getMemberWorldIds } from "../worldAccess.js";
import { DOWNTIME_ACTIVITY_TYPES } from "@spark/shared";

export const downtimeRouter = Router();

async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}

downtimeRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.downtimeActivity.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toDowntimeActivityDTO));
});

downtimeRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, playerCharacterId, characterName, activityType, description, daysSpent, outcome } = body;

  if (
    typeof worldId !== "string" ||
    typeof characterName !== "string" || !characterName.trim() ||
    typeof activityType !== "string" || !(DOWNTIME_ACTIVITY_TYPES as readonly string[]).includes(activityType) ||
    typeof description !== "string" || !description.trim() ||
    typeof daysSpent !== "number" || !Number.isFinite(daysSpent) || daysSpent <= 0
  ) {
    return res.status(400).json({ error: "Missing or invalid downtime activity fields" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const row = await prisma.downtimeActivity.create({
    data: {
      worldId,
      playerCharacterId: typeof playerCharacterId === "string" ? playerCharacterId : null,
      characterName: characterName.trim(),
      activityType,
      description: description.trim(),
      daysSpent: Math.trunc(daysSpent),
      outcome: typeof outcome === "string" && outcome.trim() ? outcome.trim() : null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toDowntimeActivityDTO(row));
});

downtimeRouter.delete("/:id", async (req, res) => {
  const row = await prisma.downtimeActivity.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Downtime activity not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this downtime activity" });

  await prisma.downtimeActivity.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

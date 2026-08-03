import { Router } from "express";
import { prisma } from "../db.js";
import { toRollLogEntryDTO } from "../serialize.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const rollLogRouter = Router();

async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}

rollLogRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const isOwner = world.userId === req.userId;
  const rows = await prisma.rollLogEntry.findMany({
    where: { worldId, ...(isOwner ? {} : { hiddenFromParty: false }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(rows.map(toRollLogEntryDTO));
});

rollLogRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, rollerName, notation, results, modifier, total, mode, label, hiddenFromParty } = body;

  if (!worldId || !rollerName || !notation || !Array.isArray(results) || typeof total !== "number") {
    return res.status(400).json({ error: "Missing required roll log fields" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const isOwner = world.userId === req.userId;
  const row = await prisma.rollLogEntry.create({
    data: {
      worldId,
      rollerName,
      notation,
      results: JSON.stringify(results),
      modifier: Number(modifier) || 0,
      total: Number(total),
      mode: mode === "adv" || mode === "dis" ? mode : null,
      label: label ?? null,
      hiddenFromParty: hiddenFromParty === true && isOwner,
      userId: req.userId!,
    },
  });
  res.status(201).json(toRollLogEntryDTO(row));
});

rollLogRouter.delete("/:id", async (req, res) => {
  const row = await prisma.rollLogEntry.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Roll not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this roll" });

  await prisma.rollLogEntry.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

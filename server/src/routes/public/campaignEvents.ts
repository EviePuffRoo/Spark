import { Router } from "express";
import { prisma } from "../../db.js";
import { toCampaignEventDTO } from "../../serialize.js";

export const publicCampaignEventsRouter = Router();

publicCampaignEventsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await prisma.world.findFirst({ where: { id: worldId, userId: req.userId } });
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.campaignEvent.findMany({ where: { worldId }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(toCampaignEventDTO));
});

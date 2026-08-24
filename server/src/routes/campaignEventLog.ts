import { Router } from "express";
import { prisma } from "../db.js";
import { toCampaignEventLogEntryDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";

export const campaignEventLogRouter = Router();

const PAGE_SIZE = 30;

// Read side of the unified activity feed (see CampaignEventLog in the
// schema): one endpoint over the dual-written stream instead of visiting
// each NPC's/faction's own log separately. Same owner-or-member access
// check as every other world-scoped GET.
campaignEventLogRouter.get("/", async (req, res) => {
  const { worldId, cursor } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.campaignEventLog.findMany({
    where: { worldId },
    orderBy: { createdAt: "desc" },
    ...(typeof cursor === "string" ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  res.json({
    entries: page.map(toCampaignEventLogEntryDTO),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
});

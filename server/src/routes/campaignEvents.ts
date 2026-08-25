import { Router } from "express";
import { prisma } from "../db.js";
import { toCampaignEventDTO } from "../serialize.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite } from "../worldAccess.js";
import { logCampaignEventOp } from "../campaignEventLog.js";
import { dispatchWebhookEvent } from "../webhookDispatch.js";

export const campaignEventsRouter = Router();

campaignEventsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.campaignEvent.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toCampaignEventDTO));
});

campaignEventsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, title, description, factionId } = body;

  if (
    typeof worldId !== "string" ||
    typeof title !== "string" || !title.trim() ||
    typeof description !== "string" || !description.trim() ||
    (factionId !== undefined && typeof factionId !== "string")
  ) {
    return res.status(400).json({ error: "worldId, title, and description are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  if (typeof factionId === "string") {
    const memberWorldIds = await getMemberWorldIds(req.userId!);
    const faction = await prisma.faction.findFirst({ where: { id: factionId, worldId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
    if (!faction) return res.status(403).json({ error: "You don't have access to this faction" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const authorName = user?.displayName || user?.username || "The DM";
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  const [row] = await prisma.$transaction([
    prisma.campaignEvent.create({
      data: {
        worldId, title: trimmedTitle, description: trimmedDescription,
        factionId: typeof factionId === "string" ? factionId : null,
        userId: req.userId!,
      },
    }),
    logCampaignEventOp({
      worldId, entityType: "campaignEvent", entityId: null, eventType: "campaignEvent.logged",
      payload: { title: trimmedTitle, description: trimmedDescription, factionId: typeof factionId === "string" ? factionId : null },
      authorName, userId: req.userId!,
    }),
  ]);
  void dispatchWebhookEvent(worldId, {
    entityType: "campaignEvent", entityId: null, eventType: "campaignEvent.logged",
    payload: { title: trimmedTitle, description: trimmedDescription, factionId: typeof factionId === "string" ? factionId : null },
    authorName,
  });
  res.status(201).json(toCampaignEventDTO(row as Parameters<typeof toCampaignEventDTO>[0]));
});

campaignEventsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.campaignEvent.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Campaign event not found" });
  }
  await prisma.campaignEvent.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

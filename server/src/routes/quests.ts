import { Router } from "express";
import { prisma } from "../db.js";
import { toQuestHookDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";

export const questsRouter = Router();

// Walking the chain here (rather than just checking direct self-reference)
// keeps the invariant that a quest's prerequisite chain never loops —
// Phase B's chain readout walks this same link forward and would spin
// forever on a cycle. Bounded to guard against any pre-existing bad data.
async function wouldCreateCycle(questId: string, candidatePrereqId: string): Promise<boolean> {
  let currentId: string | null = candidatePrereqId;
  for (let i = 0; i < 100 && currentId; i++) {
    if (currentId === questId) return true;
    const row: { prerequisiteQuestId: string | null } | null = await prisma.questHook.findUnique({
      where: { id: currentId },
      select: { prerequisiteQuestId: true },
    });
    currentId = row?.prerequisiteQuestId ?? null;
  }
  return false;
}

questsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.questHook.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toQuestHookDTO));
});

questsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.questHook.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Quest hook not found" });
  res.json(toQuestHookDTO(row));
});

questsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, questType, tier, hook, objective, complication, reward, worldId, tags, notes, hiddenFromParty, prerequisiteQuestId } = body;

  if (!title || !questType || !tier || !hook || !objective || !complication || !reward) {
    return res.status(400).json({ error: "Missing required quest hook fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }
  if (typeof prerequisiteQuestId === "string") {
    const prereq = await prisma.questHook.findFirst({ where: { id: prerequisiteQuestId, userId: req.userId } });
    if (!prereq) return res.status(403).json({ error: "You don't have access to this quest" });
  }

  const row = await prisma.questHook.create({
    data: {
      title, questType, tier, hook, objective, complication, reward,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      prerequisiteQuestId: prerequisiteQuestId ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toQuestHookDTO(row));
});

questsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "questType", "tier", "hook", "objective", "complication", "reward", "status", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if ("prerequisiteQuestId" in body) {
    if (typeof body.prerequisiteQuestId === "string") {
      if (body.prerequisiteQuestId === req.params.id) {
        return res.status(400).json({ error: "A quest cannot be its own prerequisite" });
      }
      const prereq = await prisma.questHook.findFirst({ where: { id: body.prerequisiteQuestId, userId: req.userId } });
      if (!prereq) return res.status(403).json({ error: "You don't have access to this quest" });
      if (await wouldCreateCycle(req.params.id, body.prerequisiteQuestId)) {
        return res.status(400).json({ error: "This would create a prerequisite cycle" });
      }
    }
    data.prerequisiteQuestId = body.prerequisiteQuestId ?? null;
  }

  const result = await prisma.questHook.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Quest hook not found" });
  const row = await prisma.questHook.findUnique({ where: { id: req.params.id } });

  // Guild Board completion callback: if this is a quest another DM
  // claimed from the gallery and it just became "completed" for the
  // first time, tell the original poster's world what happened — the
  // one deliberate, narrow cross-account write in the whole app (see
  // GuildJobClaim's schema comment). Fires at most once per claim.
  if (data.status === "completed") {
    const claim = await prisma.guildJobClaim.findFirst({ where: { claimerQuestHookId: row!.id, completedAt: null } });
    if (claim && claim.posterWorldId) {
      const posterWorld = await prisma.world.findUnique({ where: { id: claim.posterWorldId } });
      if (posterWorld) {
        await prisma.$transaction([
          prisma.campaignEvent.create({
            data: {
              worldId: claim.posterWorldId,
              title: "A distant company answers the call",
              description: `Word reaches you that another band of adventurers, far from here, took up "${row!.title}" and saw it through to the end.`,
              userId: claim.posterUserId,
            },
          }),
          prisma.guildJobClaim.update({ where: { id: claim.id }, data: { completedAt: new Date() } }),
        ]);
      }
    }
  }

  res.json(toQuestHookDTO(row!));
});

questsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.questHook.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Quest hook not found" });
  await deleteLinksForEntity("quest", req.params.id, req.userId!);
  res.status(204).end();
});

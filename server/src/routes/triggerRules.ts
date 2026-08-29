import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { toTriggerRuleDTO } from "../serialize.js";
import { findAccessibleWorld, canWriteWorld, authorizeEntityWrite } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import type { TriggerCondition } from "@spark/shared";

export const triggerRulesRouter = Router();

// Bounded and typed — the same posture zoneHazardSchema/liveCombatant
// schemas in encounters.ts take, never a freeform script. A malformed
// condition fails validation outright rather than being silently
// coerced, since a rule with a broken condition would just never fire.
const triggerConditionSchema = z.object({
  kind: z.enum(["hpBelowPercent", "hpBelowValue", "conditionApplied", "roundReached"]),
  threshold: z.number().optional(),
  conditionName: z.string().optional(),
  targetKind: z.enum(["monster", "playerCharacter", "custom"]).optional(),
  namePattern: z.string().optional(),
}) satisfies z.ZodType<TriggerCondition>;

// Owner sees every rule in the world; anyone else with standing access
// sees only enabled ones — same "DM decides what's revealed" pattern
// doom clocks use for visibleToParty, applied here since a disabled rule
// is a DM's own draft/scratch note.
triggerRulesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const where = world.userId === req.userId ? { worldId } : { worldId, enabled: true };
  const rows = await prisma.triggerRule.findMany({ where, orderBy: { createdAt: "asc" } });
  res.json(rows.map(toTriggerRuleDTO));
});

triggerRulesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, name, message } = body;
  const conditionResult = triggerConditionSchema.safeParse(body.condition);

  if (
    typeof worldId !== "string" ||
    typeof name !== "string" || !name.trim() ||
    typeof message !== "string" || !message.trim() ||
    !conditionResult.success
  ) {
    return res.status(400).json({ error: "worldId, a name, a message, and a valid condition are required" });
  }

  if (!(await canWriteWorld(req.userId!, worldId))) {
    return res.status(403).json({ error: "You don't have write access to this world" });
  }

  const row = await prisma.triggerRule.create({
    data: {
      worldId,
      name: name.trim(),
      message: message.trim(),
      condition: JSON.stringify(conditionResult.data),
      announceInChat: !!body.announceInChat,
      enabled: "enabled" in body ? !!body.enabled : true,
      userId: req.userId!,
    },
  });
  publishWorldChange(worldId, "triggerRule");
  res.status(201).json(toTriggerRuleDTO(row));
});

triggerRulesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const existing = await prisma.triggerRule.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Trigger rule not found" });
  }

  const data: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return res.status(400).json({ error: "name must be a non-empty string" });
    data.name = body.name.trim();
  }
  if ("message" in body) {
    if (typeof body.message !== "string" || !body.message.trim()) return res.status(400).json({ error: "message must be a non-empty string" });
    data.message = body.message.trim();
  }
  if ("condition" in body) {
    const conditionResult = triggerConditionSchema.safeParse(body.condition);
    if (!conditionResult.success) return res.status(400).json({ error: "condition is invalid" });
    data.condition = JSON.stringify(conditionResult.data);
  }
  if ("announceInChat" in body) data.announceInChat = !!body.announceInChat;
  if ("enabled" in body) data.enabled = !!body.enabled;

  const row = await prisma.triggerRule.update({ where: { id: existing.id }, data });
  publishWorldChange(existing.worldId, "triggerRule");
  res.json(toTriggerRuleDTO(row));
});

triggerRulesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.triggerRule.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Trigger rule not found" });
  }
  await prisma.triggerRule.delete({ where: { id: req.params.id } });
  publishWorldChange(existing.worldId, "triggerRule");
  res.status(204).end();
});

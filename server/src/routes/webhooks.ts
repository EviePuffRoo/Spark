import { Router } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { validateWebhookUrl, WebhookUrlError } from "../webhookSecurity.js";
import { deliverWebhook } from "../webhookDelivery.js";

export const webhooksRouter = Router();

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

async function requireOwnerWorld(userId: string, worldId: string) {
  return prisma.world.findFirst({ where: { id: worldId, userId } });
}

// Owner-only for all routes below — a world's outgoing webhook is DM
// configuration, same trust tier as its join code.
webhooksRouter.get("/:worldId/webhook", async (req, res) => {
  const world = await requireOwnerWorld(req.userId!, req.params.worldId);
  if (!world) return res.status(404).json({ error: "World not found" });

  const webhook = await prisma.worldWebhook.findUnique({ where: { worldId: world.id } });
  if (!webhook) return res.status(404).json({ error: "No webhook configured for this world" });
  res.json({
    url: webhook.url,
    enabled: webhook.enabled,
    lastDeliveryAt: webhook.lastDeliveryAt?.toISOString(),
    lastDeliveryOk: webhook.lastDeliveryOk ?? undefined,
    lastDeliveryError: webhook.lastDeliveryError ?? undefined,
  });
});

// Creates or fully replaces this world's webhook (one per world). Returns
// the plaintext secret once — same one-time-reveal pattern as a join code
// or recovery code — since the DM needs it to verify delivery signatures
// on their own endpoint and Spark never shows it again after this.
webhooksRouter.post("/:worldId/webhook", async (req, res) => {
  const world = await requireOwnerWorld(req.userId!, req.params.worldId);
  if (!world) return res.status(404).json({ error: "World not found" });

  const { url } = req.body ?? {};
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "url is required" });
  }
  try {
    await validateWebhookUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err instanceof WebhookUrlError ? err.message : "Invalid webhook URL." });
  }

  const secret = generateSecret();
  await prisma.worldWebhook.upsert({
    where: { worldId: world.id },
    create: { worldId: world.id, url, secret, enabled: true },
    update: { url, secret, enabled: true, lastDeliveryAt: null, lastDeliveryOk: null, lastDeliveryError: null },
  });
  res.status(201).json({ secret });
});

// Toggle enabled on/off without touching the URL or secret.
webhooksRouter.patch("/:worldId/webhook", async (req, res) => {
  const world = await requireOwnerWorld(req.userId!, req.params.worldId);
  if (!world) return res.status(404).json({ error: "World not found" });
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });

  const result = await prisma.worldWebhook.updateMany({ where: { worldId: world.id }, data: { enabled } });
  if (result.count === 0) return res.status(404).json({ error: "No webhook configured for this world" });
  res.status(204).end();
});

webhooksRouter.delete("/:worldId/webhook", async (req, res) => {
  const world = await requireOwnerWorld(req.userId!, req.params.worldId);
  if (!world) return res.status(404).json({ error: "World not found" });
  await prisma.worldWebhook.deleteMany({ where: { worldId: world.id } });
  res.status(204).end();
});

// Sends an immediate test ping and reports the outcome synchronously — the
// one place a DM-triggered webhook call is worth the delivery's own
// latency, since they're explicitly asking "does this work right now?"
webhooksRouter.post("/:worldId/webhook/test", async (req, res) => {
  const world = await requireOwnerWorld(req.userId!, req.params.worldId);
  if (!world) return res.status(404).json({ error: "World not found" });

  const webhook = await prisma.worldWebhook.findUnique({ where: { worldId: world.id } });
  if (!webhook) return res.status(404).json({ error: "No webhook configured for this world" });

  const result = await deliverWebhook(webhook.url, webhook.secret, {
    worldId: world.id,
    entityType: "campaignEvent",
    entityId: null,
    eventType: "webhook.test",
    payload: { message: "This is a test ping from Spark." },
    authorName: "Spark",
    createdAt: new Date().toISOString(),
  });

  await prisma.worldWebhook.update({
    where: { worldId: world.id },
    data: {
      lastDeliveryAt: new Date(),
      lastDeliveryOk: result.ok,
      lastDeliveryError: result.ok ? null : (result.error ?? "Delivery failed."),
    },
  });

  res.json({ ok: result.ok, status: result.status, error: result.error });
});

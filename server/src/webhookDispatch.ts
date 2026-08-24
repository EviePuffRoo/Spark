import { prisma } from "./db.js";
import { deliverWebhook } from "./webhookDelivery.js";
import type { CampaignLogEntityType } from "./campaignEventLog.js";

export interface WebhookEventInput {
  entityType: CampaignLogEntityType;
  entityId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  authorName: string;
}

// Fire-and-forget: called right after a CampaignEventLog-writing
// transaction commits, for every one of its six call sites. Never
// awaited by the caller — a slow or dead webhook endpoint must never add
// latency to the DM's actual request. Delivery failures are swallowed
// here (recorded on the WorldWebhook row for the DM to see in the UI),
// not surfaced to the triggering request.
export async function dispatchWebhookEvent(worldId: string | null, event: WebhookEventInput): Promise<void> {
  if (!worldId) return;
  try {
    const webhook = await prisma.worldWebhook.findUnique({ where: { worldId } });
    if (!webhook || !webhook.enabled) return;

    const result = await deliverWebhook(webhook.url, webhook.secret, {
      worldId,
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      payload: event.payload,
      authorName: event.authorName,
      createdAt: new Date().toISOString(),
    });

    await prisma.worldWebhook.update({
      where: { worldId },
      data: {
        lastDeliveryAt: new Date(),
        lastDeliveryOk: result.ok,
        lastDeliveryError: result.ok ? null : (result.error ?? "Delivery failed."),
      },
    });
  } catch {
    // Best-effort by design (see module docs) — a dispatch failure (e.g.
    // the webhook was deleted mid-flight) must never surface as an
    // unhandled rejection from a call site that never awaits this.
  }
}

import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toWorldTickLogDTO } from "../serialize.js";
import { findAccessibleWorld, worldOwnerIsPaid } from "../worldAccess.js";
import { logCampaignEventOp } from "../campaignEventLog.js";
import { dispatchWebhookEvent, type WebhookEventInput } from "../webhookDispatch.js";
import { computeWorldTickProposal } from "@spark/shared";
import type { WorldTickProposalItem, ShopStockEntry, FactionRelationshipStance } from "@spark/shared";

export const worldTickRouter = Router();

// World Tick is a DM-only action (it rewrites reputation, disposition,
// shop prices, and creates campaign events across the whole world), so it
// gets its own stricter check rather than findAccessibleWorld's owner-or-
// member read/narrow-write access.
async function requireOwnerWorld(userId: string, worldId: string) {
  return prisma.world.findFirst({ where: { id: worldId, userId } });
}

// Computes a proposal without writing anything — fromDay picks up where
// the last applied tick left off (or day 1 if this world has never had
// one), toDay is the world's current calendar day. Re-fetching this is
// always safe: computeWorldTickProposal is a deterministic pure function
// of exactly this input, so the same day range proposes the same changes
// until the underlying roster/relationships actually change.
worldTickRouter.get("/:worldId/proposal", async (req, res) => {
  const { worldId } = req.params;
  const world = await requireOwnerWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "Only the world's owner can run a World Tick" });

  const lastLog = await prisma.worldTickLog.findFirst({ where: { worldId }, orderBy: { toDay: "desc" } });
  const fromDay = lastLog?.toDay ?? 1;
  const toDay = world.currentDay;

  const [factions, relationships, characters, shops] = await Promise.all([
    prisma.faction.findMany({ where: { worldId } }),
    prisma.factionRelationship.findMany({ where: { worldId } }),
    prisma.character.findMany({ where: { worldId } }),
    prisma.shop.findMany({ where: { worldId } }),
  ]);

  const proposal = computeWorldTickProposal({
    worldId, fromDay, toDay,
    factions: factions.map((f) => ({ id: f.id, name: f.name, hiddenFromParty: f.hiddenFromParty })),
    relationships: relationships.map((r) => ({ id: r.id, factionAId: r.factionAId, factionBId: r.factionBId, stance: r.stance as FactionRelationshipStance })),
    characters: characters.map((c) => ({ id: c.id, name: c.name, factionId: c.factionId ?? undefined, hiddenFromParty: c.hiddenFromParty })),
    shops: shops.map((s) => ({ id: s.id, name: s.name, stock: JSON.parse(s.stock) as ShopStockEntry[] })),
  });

  res.json(proposal);
});

// Applies exactly the proposal items the DM approved (a subset of what GET
// .../proposal returned) — the DM's own client is trusted with the full
// item payload the same way a full encounter PUT already is, rather than
// round-tripping ids and recomputing. Every referenced faction/character/
// shop is still re-validated against this worldId below before anything
// is written, so a stale or tampered item can't touch another world.
worldTickRouter.post("/:worldId/apply", async (req, res) => {
  const { worldId } = req.params;
  const world = await requireOwnerWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "Only the world's owner can run a World Tick" });
  if (!(await worldOwnerIsPaid(world.userId))) {
    return res.status(403).json({ error: "Applying a World Tick is a paid feature — upgrade to lock in the changes. Previewing a proposal stays free.", code: "world_tick_paid_only" });
  }

  const body = req.body ?? {};
  const { fromDay, toDay, items } = body;
  if (typeof fromDay !== "number" || typeof toDay !== "number" || !Array.isArray(items)) {
    return res.status(400).json({ error: "fromDay, toDay, and items are required" });
  }

  const authorName = "World Tick";
  const factionOps: { id: string; delta: number; reason?: string }[] = [];
  const characterOps: { id: string; delta: number; reason?: string }[] = [];
  const eventOps: { title: string; description: string; factionId?: string }[] = [];
  const shopDeltas = new Map<string, Map<string, number>>();

  for (const raw of items as WorldTickProposalItem[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.kind === "factionReputation" && typeof raw.factionId === "string" && typeof raw.delta === "number" && raw.delta !== 0) {
      factionOps.push({ id: raw.factionId, delta: Math.trunc(raw.delta), reason: raw.reasonOrTitle });
    } else if (raw.kind === "characterDisposition" && typeof raw.characterId === "string" && typeof raw.delta === "number" && raw.delta !== 0) {
      characterOps.push({ id: raw.characterId, delta: Math.trunc(raw.delta), reason: raw.reasonOrTitle });
    } else if (raw.kind === "campaignEvent" && typeof raw.reasonOrTitle === "string" && typeof raw.description === "string") {
      eventOps.push({ title: raw.reasonOrTitle, description: raw.description, factionId: raw.factionId });
    } else if (raw.kind === "shopStock" && typeof raw.shopId === "string" && typeof raw.stockEntryId === "string" && typeof raw.delta === "number" && raw.delta !== 0) {
      if (!shopDeltas.has(raw.shopId)) shopDeltas.set(raw.shopId, new Map());
      shopDeltas.get(raw.shopId)!.set(raw.stockEntryId, Math.trunc(raw.delta));
    }
  }

  const [factionRows, characterRows, shopRows] = await Promise.all([
    factionOps.length ? prisma.faction.findMany({ where: { id: { in: factionOps.map((o) => o.id) }, worldId } }) : Promise.resolve([]),
    characterOps.length ? prisma.character.findMany({ where: { id: { in: characterOps.map((o) => o.id) }, worldId } }) : Promise.resolve([]),
    shopDeltas.size ? prisma.shop.findMany({ where: { id: { in: [...shopDeltas.keys()] }, worldId } }) : Promise.resolve([]),
  ]);
  const validFactionIds = new Set(factionRows.map((f) => f.id));
  const validCharacterIds = new Set(characterRows.map((c) => c.id));
  const validShopById = new Map(shopRows.map((s) => [s.id, s] as const));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const webhookEvents: WebhookEventInput[] = [];
  let itemCount = 0;

  for (const op of factionOps) {
    if (!validFactionIds.has(op.id)) continue;
    ops.push(prisma.faction.update({ where: { id: op.id }, data: { reputation: { increment: op.delta } } }));
    ops.push(prisma.factionLogEntry.create({ data: { factionId: op.id, authorName, delta: op.delta, reason: op.reason ?? null, userId: req.userId! } }));
    ops.push(logCampaignEventOp({
      worldId, entityType: "factionReputation", entityId: op.id, eventType: "faction.reputationChanged",
      payload: { factionId: op.id, delta: op.delta, reason: op.reason }, authorName, userId: req.userId!,
    }));
    webhookEvents.push({
      entityType: "factionReputation", entityId: op.id, eventType: "faction.reputationChanged",
      payload: { factionId: op.id, delta: op.delta, reason: op.reason }, authorName,
    });
    itemCount++;
  }
  for (const op of characterOps) {
    if (!validCharacterIds.has(op.id)) continue;
    ops.push(prisma.character.update({ where: { id: op.id }, data: { disposition: { increment: op.delta } } }));
    ops.push(prisma.dispositionLogEntry.create({ data: { characterId: op.id, authorName, delta: op.delta, reason: op.reason ?? null, userId: req.userId! } }));
    ops.push(logCampaignEventOp({
      worldId, entityType: "disposition", entityId: op.id, eventType: "disposition.adjusted",
      payload: { characterId: op.id, delta: op.delta, reason: op.reason }, authorName, userId: req.userId!,
    }));
    webhookEvents.push({
      entityType: "disposition", entityId: op.id, eventType: "disposition.adjusted",
      payload: { characterId: op.id, delta: op.delta, reason: op.reason }, authorName,
    });
    itemCount++;
  }
  for (const ev of eventOps) {
    ops.push(prisma.campaignEvent.create({ data: { worldId, title: ev.title, description: ev.description, factionId: ev.factionId ?? null, userId: req.userId! } }));
    ops.push(logCampaignEventOp({
      worldId, entityType: "campaignEvent", entityId: null, eventType: "campaignEvent.logged",
      payload: { title: ev.title, description: ev.description, factionId: ev.factionId }, authorName, userId: req.userId!,
    }));
    webhookEvents.push({
      entityType: "campaignEvent", entityId: null, eventType: "campaignEvent.logged",
      payload: { title: ev.title, description: ev.description, factionId: ev.factionId }, authorName,
    });
    itemCount++;
  }
  for (const [shopId, entryDeltas] of shopDeltas) {
    const shop = validShopById.get(shopId);
    if (!shop) continue;
    const stock = JSON.parse(shop.stock) as ShopStockEntry[];
    let changed = false;
    for (const entry of stock) {
      const delta = entryDeltas.get(entry.id);
      if (delta === undefined) continue;
      entry.price = Math.max(1, entry.price + delta);
      changed = true;
      itemCount++;
    }
    if (changed) ops.push(prisma.shop.update({ where: { id: shopId }, data: { stock: JSON.stringify(stock) } }));
  }

  ops.push(prisma.worldTickLog.create({
    data: { worldId, fromDay: Math.trunc(fromDay), toDay: Math.trunc(toDay), itemCount, userId: req.userId! },
  }));
  ops.push(logCampaignEventOp({
    worldId, entityType: "worldTick", entityId: null, eventType: "worldTick.applied",
    payload: { fromDay: Math.trunc(fromDay), toDay: Math.trunc(toDay), itemCount }, authorName, userId: req.userId!,
  }));
  webhookEvents.push({
    entityType: "worldTick", entityId: null, eventType: "worldTick.applied",
    payload: { fromDay: Math.trunc(fromDay), toDay: Math.trunc(toDay), itemCount }, authorName,
  });

  const results = await prisma.$transaction(ops);
  const logRow = results[results.length - 2];
  for (const event of webhookEvents) void dispatchWebhookEvent(worldId, event);
  res.status(201).json(toWorldTickLogDTO(logRow as Parameters<typeof toWorldTickLogDTO>[0]));
});

worldTickRouter.get("/:worldId/log", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.worldTickLog.findMany({ where: { worldId }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json(rows.map(toWorldTickLogDTO));
});

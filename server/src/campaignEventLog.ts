import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

// What kind of Spark entity this event happened to. Kept narrow and
// stable — it's meant to be a queryable/filterable dimension on the
// unified timeline, not a dumping ground for every possible string.
export type CampaignLogEntityType = "disposition" | "factionReputation" | "campaignEvent" | "worldTick";

interface LogEntryInput {
  worldId: string | null;
  entityType: CampaignLogEntityType;
  entityId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  authorName: string;
  userId: string;
}

// Builds (but does not execute) one CampaignEventLog create op, meant to
// be included in the same $transaction as the write it's mirroring — see
// each call site for how it slots into that entity's existing
// disposition/reputation/event/tick transaction. This table is a dual
// write, not a replacement: the per-feature tables (DispositionLogEntry,
// FactionLogEntry, CampaignEvent, WorldTickLog) stay the system of record
// for their own features and are untouched by this.
export function logCampaignEventOp(input: LogEntryInput): Prisma.PrismaPromise<unknown> {
  return prisma.campaignEventLog.create({
    data: {
      worldId: input.worldId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      payload: JSON.stringify(input.payload),
      authorName: input.authorName,
      userId: input.userId,
    },
  });
}

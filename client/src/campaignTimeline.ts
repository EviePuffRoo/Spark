import type { SessionNote, QuestHook, Adventure, EntityType } from "@spark/shared";

export type TimelineEntryKind = "note" | "quest" | "adventure";

export interface TimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  date: string;
  title: string;
  summary: string;
  meta?: string;
  worldId?: string | null;
  userId: string;
  entityType: EntityType;
  entityId: string;
}

export function buildTimelineEntries(notes: SessionNote[], quests: QuestHook[], adventures: Adventure[]): TimelineEntry[] {
  const noteEntries: TimelineEntry[] = notes.map((n) => ({
    id: `note-${n.id}`,
    kind: "note",
    date: n.sessionDate ?? n.createdAt,
    title: n.title,
    summary: n.summary,
    meta: n.sessionLabel,
    worldId: n.worldId,
    userId: n.userId,
    entityType: "sessionNote",
    entityId: n.id,
  }));

  const questEntries: TimelineEntry[] = quests.map((q) => ({
    id: `quest-${q.id}`,
    kind: "quest",
    date: q.createdAt,
    title: q.title,
    summary: q.hook,
    meta: q.status,
    worldId: q.worldId,
    userId: q.userId,
    entityType: "quest",
    entityId: q.id,
  }));

  const adventureEntries: TimelineEntry[] = adventures.map((a) => ({
    id: `adventure-${a.id}`,
    kind: "adventure",
    date: a.createdAt,
    title: a.title,
    summary: a.premise,
    meta: a.tier,
    worldId: a.worldId,
    userId: a.userId,
    entityType: "adventure",
    entityId: a.id,
  }));

  return [...noteEntries, ...questEntries, ...adventureEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

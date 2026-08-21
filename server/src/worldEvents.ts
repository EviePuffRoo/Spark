import { EventEmitter } from "node:events";
import type { TokenMovedBroadcast } from "@spark/shared";

// In-memory, single-process pub/sub for "something changed in this world"
// signals, powering the SSE live channel (routes/worldLive.ts). Deliberately
// carries no payload — encounter/roll-log data is redacted per-viewer
// (toEncounterDTO, the roll log's hiddenFromParty filter), so a shared
// broadcast payload would leak DM-only data to party members. Each SSE
// connection reacts to the signal by re-running its own redacted read,
// scoped to its own userId, exactly like the existing REST GET handlers do.
//
// Single-process only: if Spark ever runs multiple server instances, this
// needs to move to a shared broker (e.g. Redis pub/sub) since a publish on
// one instance never reaches a subscriber connected to another. Not needed
// today — deployment is one Node process (app.listen) backed by SQLite.

export type WorldChangeKind = "encounter" | "ledger" | "rollLog" | "chat";

// The one deliberate exception to "no payload" above: an in-progress token
// drag is broadcast directly, bypassing the full encounter redaction pass
// entirely, since routing every tick of a drag through sendEncounter's DB
// read + full-combatant-list redaction would make live dragging janky for
// everyone watching. `hidden` still travels through this internal payload
// (it's what worldLive.ts uses to decide whether a given connection is
// even allowed to see this token move) — it's stripped before anything
// reaches the wire.
export interface TokenPositionBroadcast extends TokenMovedBroadcast {
  hidden: boolean;
}

const CHANGE_EVENT = "change";
const TOKEN_MOVED_EVENT = "tokenMoved";
const emitters = new Map<string, EventEmitter>();

function getOrCreateEmitter(worldId: string): EventEmitter {
  let emitter = emitters.get(worldId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    emitters.set(worldId, emitter);
  }
  return emitter;
}

// Both event kinds above share one emitter per world, so cleanup has to
// wait until neither has any listeners left, not just the one being
// unsubscribed here.
function deleteIfIdle(worldId: string, emitter: EventEmitter) {
  if (emitter.listenerCount(CHANGE_EVENT) === 0 && emitter.listenerCount(TOKEN_MOVED_EVENT) === 0) {
    emitters.delete(worldId);
  }
}

export function publishWorldChange(worldId: string, kind: WorldChangeKind): void {
  emitters.get(worldId)?.emit(CHANGE_EVENT, kind);
}

export function subscribeToWorld(worldId: string, listener: (kind: WorldChangeKind) => void): () => void {
  const emitter = getOrCreateEmitter(worldId);
  emitter.on(CHANGE_EVENT, listener);
  return () => {
    emitter.off(CHANGE_EVENT, listener);
    deleteIfIdle(worldId, emitter);
  };
}

export function publishTokenMoved(worldId: string, payload: TokenPositionBroadcast): void {
  emitters.get(worldId)?.emit(TOKEN_MOVED_EVENT, payload);
}

export function subscribeToTokenMoved(worldId: string, listener: (payload: TokenPositionBroadcast) => void): () => void {
  const emitter = getOrCreateEmitter(worldId);
  emitter.on(TOKEN_MOVED_EVENT, listener);
  return () => {
    emitter.off(TOKEN_MOVED_EVENT, listener);
    deleteIfIdle(worldId, emitter);
  };
}

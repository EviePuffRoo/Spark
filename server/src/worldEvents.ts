import { EventEmitter } from "node:events";

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

const CHANGE_EVENT = "change";
const emitters = new Map<string, EventEmitter>();

export function publishWorldChange(worldId: string, kind: WorldChangeKind): void {
  emitters.get(worldId)?.emit(CHANGE_EVENT, kind);
}

export function subscribeToWorld(worldId: string, listener: (kind: WorldChangeKind) => void): () => void {
  let emitter = emitters.get(worldId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    emitters.set(worldId, emitter);
  }
  emitter.on(CHANGE_EVENT, listener);
  return () => {
    emitter!.off(CHANGE_EVENT, listener);
    if (emitter!.listenerCount(CHANGE_EVENT) === 0) emitters.delete(worldId);
  };
}

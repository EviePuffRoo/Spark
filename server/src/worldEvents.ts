import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import type { TokenMovedBroadcast } from "@spark/shared";
import { logger } from "./logger.js";

// Pub/sub for "something changed in this world" signals, powering the SSE
// live channel (routes/worldLive.ts). Deliberately carries no payload for
// the "change" event — encounter/roll-log data is redacted per-viewer
// (toEncounterDTO, the roll log's hiddenFromParty filter), so a shared
// broadcast payload would leak DM-only data to party members. Each SSE
// connection reacts to the signal by re-running its own redacted read,
// scoped to its own userId, exactly like the existing REST GET handlers do.
//
// Every process keeps its own in-memory emitters for same-process delivery
// (zero added latency, and the only path used at all when Spark runs as one
// instance — today's deployment, per render.yaml). When REDIS_URL is set
// (initRealtimeBackbone(), called once from index.ts), publishes also go out
// on a shared Redis channel so other processes' local emitters fire too —
// see RealtimeBackbone below. Nothing about the exported function shapes
// changes based on whether Redis is configured, so every existing call site
// (routes, worldLive.ts) and worldEvents.test.ts need no changes either way.

export type WorldChangeKind = "encounter" | "ledger" | "rollLog" | "chat" | "doomClock" | "triggerRule";

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
const REDIS_CHANNEL = "spark:world-events";

type RedisPayload =
  | { type: "change"; worldId: string; kind: WorldChangeKind }
  | { type: "tokenMoved"; worldId: string; payload: TokenPositionBroadcast };
type RedisMessage = RedisPayload & { origin: string };

// One backbone = one process's local emitters, plus an optional Redis
// pub/sub pair for fanning events out to (and receiving them from) other
// processes. Exported as a class, not just the module-level singleton
// below, so tests can construct two independent backbones sharing one real
// Redis server and prove cross-process delivery — without needing to
// actually run Spark as two OS processes.
export class RealtimeBackbone {
  private emitters = new Map<string, EventEmitter>();
  private instanceId = randomUUID();
  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;

  connectRedis(redisUrl: string): void {
    this.redisPub = new Redis(redisUrl);
    this.redisSub = new Redis(redisUrl);
    this.redisPub.on("error", (err: Error) => logger.error({ err }, "[realtime] Redis publish connection error"));
    this.redisSub.on("error", (err: Error) => logger.error({ err }, "[realtime] Redis subscribe connection error"));
    this.redisSub.subscribe(REDIS_CHANNEL).catch((err: unknown) => {
      logger.error({ err }, "[realtime] Failed to subscribe to Redis channel");
    });
    this.redisSub.on("message", (_channel: string, raw: string) => {
      let msg: RedisMessage;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      // Every process (including the publisher) is subscribed to the same
      // channel, so without this the publisher would double-deliver to its
      // own local subscribers — once directly, once via its own echo.
      if (msg.origin === this.instanceId) return;
      if (msg.type === "change") this.emitChangeLocally(msg.worldId, msg.kind);
      else this.emitTokenMovedLocally(msg.worldId, msg.payload);
    });
  }

  async disconnectRedis(): Promise<void> {
    await Promise.all([this.redisPub?.quit(), this.redisSub?.quit()]);
    this.redisPub = null;
    this.redisSub = null;
  }

  private getOrCreateEmitter(worldId: string): EventEmitter {
    let emitter = this.emitters.get(worldId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(0);
      this.emitters.set(worldId, emitter);
    }
    return emitter;
  }

  // Both event kinds share one emitter per world, so cleanup has to wait
  // until neither has any listeners left, not just the one being
  // unsubscribed here.
  private deleteIfIdle(worldId: string, emitter: EventEmitter): void {
    if (emitter.listenerCount(CHANGE_EVENT) === 0 && emitter.listenerCount(TOKEN_MOVED_EVENT) === 0) {
      this.emitters.delete(worldId);
    }
  }

  private emitChangeLocally(worldId: string, kind: WorldChangeKind): void {
    this.emitters.get(worldId)?.emit(CHANGE_EVENT, kind);
  }

  private emitTokenMovedLocally(worldId: string, payload: TokenPositionBroadcast): void {
    this.emitters.get(worldId)?.emit(TOKEN_MOVED_EVENT, payload);
  }

  private publishToRedis(message: RedisPayload): void {
    if (!this.redisPub) return;
    this.redisPub.publish(REDIS_CHANNEL, JSON.stringify({ ...message, origin: this.instanceId })).catch((err: unknown) => {
      logger.error({ err }, "[realtime] Failed to publish to Redis");
    });
  }

  publishWorldChange(worldId: string, kind: WorldChangeKind): void {
    this.emitChangeLocally(worldId, kind);
    this.publishToRedis({ type: "change", worldId, kind });
  }

  subscribeToWorld(worldId: string, listener: (kind: WorldChangeKind) => void): () => void {
    const emitter = this.getOrCreateEmitter(worldId);
    emitter.on(CHANGE_EVENT, listener);
    return () => {
      emitter.off(CHANGE_EVENT, listener);
      this.deleteIfIdle(worldId, emitter);
    };
  }

  publishTokenMoved(worldId: string, payload: TokenPositionBroadcast): void {
    this.emitTokenMovedLocally(worldId, payload);
    this.publishToRedis({ type: "tokenMoved", worldId, payload });
  }

  subscribeToTokenMoved(worldId: string, listener: (payload: TokenPositionBroadcast) => void): () => void {
    const emitter = this.getOrCreateEmitter(worldId);
    emitter.on(TOKEN_MOVED_EVENT, listener);
    return () => {
      emitter.off(TOKEN_MOVED_EVENT, listener);
      this.deleteIfIdle(worldId, emitter);
    };
  }
}

const defaultBackbone = new RealtimeBackbone();

// Called once from index.ts at process start, mirroring scheduleBackups()
// in dbBackup.ts — never called from tests (which only import app.ts), so
// REDIS_URL being unset in every test/dev environment means this whole path
// is simply never exercised there, and the local-only behavior below is
// exactly what worldEvents.test.ts already covers.
export function initRealtimeBackbone(): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info("[realtime] REDIS_URL not set — world-change events stay in-process (fine for a single server instance).");
    return;
  }
  defaultBackbone.connectRedis(redisUrl);
  logger.info("[realtime] REDIS_URL is set — world-change events fan out across processes via Redis pub/sub.");
}

export function publishWorldChange(worldId: string, kind: WorldChangeKind): void {
  defaultBackbone.publishWorldChange(worldId, kind);
}

export function subscribeToWorld(worldId: string, listener: (kind: WorldChangeKind) => void): () => void {
  return defaultBackbone.subscribeToWorld(worldId, listener);
}

export function publishTokenMoved(worldId: string, payload: TokenPositionBroadcast): void {
  defaultBackbone.publishTokenMoved(worldId, payload);
}

export function subscribeToTokenMoved(worldId: string, listener: (payload: TokenPositionBroadcast) => void): () => void {
  return defaultBackbone.subscribeToTokenMoved(worldId, listener);
}

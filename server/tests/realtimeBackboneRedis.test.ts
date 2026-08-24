import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { RealtimeBackbone } from "../src/worldEvents.js";

// Proves the actual multi-process fanout mechanism against a real local
// Redis server (not a mock): two independent RealtimeBackbone instances
// stand in for two Spark server processes sharing one Redis. Skips
// gracefully wherever the `redis-server` binary isn't on PATH (this repo's
// GitHub Actions ubuntu-latest runners ship it, but not every environment
// will), rather than failing the suite over an infra dependency.
function redisServerAvailable(): boolean {
  try {
    execSync("which redis-server", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const REDIS_PORT = 16391;
const REDIS_URL = `redis://127.0.0.1:${REDIS_PORT}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.runIf(redisServerAvailable())("RealtimeBackbone with a real Redis server", () => {
  let redisProcess: ChildProcess;

  beforeAll(async () => {
    redisProcess = spawn(
      "redis-server",
      ["--port", String(REDIS_PORT), "--bind", "127.0.0.1", "--save", "", "--appendonly", "no", "--daemonize", "no"],
      { stdio: "ignore" }
    );
    // Give the server a moment to start listening before any client connects.
    await sleep(500);
  });

  afterAll(async () => {
    redisProcess.kill();
    await sleep(100);
  });

  it("delivers a publish from one backbone to a subscriber on another, without double-delivering to the publisher itself", async () => {
    const processA = new RealtimeBackbone();
    const processB = new RealtimeBackbone();
    processA.connectRedis(REDIS_URL);
    processB.connectRedis(REDIS_URL);
    // Let both subscribe connections finish subscribing before publishing.
    await sleep(300);

    const heardOnA = vi.fn();
    const heardOnB = vi.fn();
    const unsubA = processA.subscribeToWorld("cross-process-world", heardOnA);
    const unsubB = processB.subscribeToWorld("cross-process-world", heardOnB);

    processA.publishWorldChange("cross-process-world", "chat");

    await vi.waitFor(() => {
      expect(heardOnB).toHaveBeenCalledWith("chat");
    }, { timeout: 2000 });

    // The publishing process delivers locally exactly once — the Redis
    // echo-back must be suppressed by the origin check, not double-fired.
    expect(heardOnA).toHaveBeenCalledTimes(1);
    expect(heardOnA).toHaveBeenCalledWith("chat");
    expect(heardOnB).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
    await processA.disconnectRedis();
    await processB.disconnectRedis();
  });

  it("only fans out tokenMoved to tokenMoved subscribers on the other process, not change subscribers", async () => {
    const processA = new RealtimeBackbone();
    const processB = new RealtimeBackbone();
    processA.connectRedis(REDIS_URL);
    processB.connectRedis(REDIS_URL);
    await sleep(300);

    const changeHeardOnB = vi.fn();
    const tokenHeardOnB = vi.fn();
    const unsubChange = processB.subscribeToWorld("cross-process-token-world", changeHeardOnB);
    const unsubToken = processB.subscribeToTokenMoved("cross-process-token-world", tokenHeardOnB);

    processA.publishTokenMoved("cross-process-token-world", { combatantId: "c1", gridX: 2, gridY: 5, hidden: false });

    await vi.waitFor(() => {
      expect(tokenHeardOnB).toHaveBeenCalledWith({ combatantId: "c1", gridX: 2, gridY: 5, hidden: false });
    }, { timeout: 2000 });
    expect(changeHeardOnB).not.toHaveBeenCalled();

    unsubChange();
    unsubToken();
    await processA.disconnectRedis();
    await processB.disconnectRedis();
  });

  it("never delivers to a process not connected to Redis (proving the in-memory-only default stays isolated)", async () => {
    const connected = new RealtimeBackbone();
    const disconnected = new RealtimeBackbone(); // never calls connectRedis
    connected.connectRedis(REDIS_URL);
    await sleep(300);

    const heardOnDisconnected = vi.fn();
    disconnected.subscribeToWorld("isolated-world", heardOnDisconnected);

    connected.publishWorldChange("isolated-world", "encounter");
    await sleep(300);

    expect(heardOnDisconnected).not.toHaveBeenCalled();
    await connected.disconnectRedis();
  });
});

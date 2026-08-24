import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function signupAgent(username: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ username, password: "password123" });
  return { agent, userId: res.body.id as string };
}

async function logNat20(agent: request.Agent, worldId: string) {
  await agent.post("/api/roll-log").send({
    worldId, rollerName: "DM", notation: "1d20", results: [20], modifier: 0, total: 20,
  });
}

describe("achievements legacy rollup", () => {
  it("returns zero worlds and no unlocked achievements for a brand-new account", async () => {
    const { agent } = await signupAgent("legacynew");
    const res = await agent.get("/api/achievements/legacy");
    expect(res.status).toBe(200);
    expect(res.body.worldCount).toBe(0);
    expect(res.body.unlockedCount).toBe(0);
    expect(res.body.progress.every((p: { current: number }) => p.current === 0)).toBe(true);
  });

  it("sums the same stat across every owned world", async () => {
    const { agent } = await signupAgent("legacydm1");
    const worldA = await agent.post("/api/worlds").send({ name: "World A" });
    const worldB = await agent.post("/api/worlds").send({ name: "World B" });
    await logNat20(agent, worldA.body.id);
    await logNat20(agent, worldA.body.id);
    await logNat20(agent, worldB.body.id);

    const res = await agent.get("/api/achievements/legacy");
    expect(res.status).toBe(200);
    expect(res.body.worldCount).toBe(2);
    const firstBlood = res.body.progress.find((p: { id: string }) => p.id === "first-blood");
    expect(firstBlood.unlocked).toBe(true);
    const hatTrick = res.body.progress.find((p: { id: string }) => p.id === "hat-trick");
    expect(hatTrick.current).toBe(3);
    expect(hatTrick.unlocked).toBe(true);

    // Matches what the per-world endpoint reports for each world individually.
    const worldAAchievements = await agent.get(`/api/achievements?worldId=${worldA.body.id}`);
    const worldAHatTrick = worldAAchievements.body.progress.find((p: { id: string }) => p.id === "hat-trick");
    expect(worldAHatTrick.current).toBe(2);
  });

  it("includes worlds joined as a member, not just owned worlds", async () => {
    const { agent: dm } = await signupAgent("legacydm2");
    const world = await dm.post("/api/worlds").send({ name: "Shared World" });
    const joinCode = await dm.post(`/api/worlds/${world.body.id}/join-code`);
    const { agent: player } = await signupAgent("legacyplayer2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });
    await logNat20(dm, world.body.id);

    const res = await player.get("/api/achievements/legacy");
    expect(res.status).toBe(200);
    expect(res.body.worldCount).toBe(1);
    const firstBlood = res.body.progress.find((p: { id: string }) => p.id === "first-blood");
    expect(firstBlood.unlocked).toBe(true);
  });

  it("keeps each account's legacy scoped to its own worlds", async () => {
    const { agent: dm1 } = await signupAgent("legacydm3");
    const world1 = await dm1.post("/api/worlds").send({ name: "DM1 World" });
    await logNat20(dm1, world1.body.id);

    const { agent: dm2 } = await signupAgent("legacydm4");
    const res = await dm2.get("/api/achievements/legacy");
    expect(res.body.worldCount).toBe(0);
    const firstBlood = res.body.progress.find((p: { id: string }) => p.id === "first-blood");
    expect(firstBlood.unlocked).toBe(false);
  });
});

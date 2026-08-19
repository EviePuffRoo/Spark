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

function roll(worldId: string, notation: string, total: number, extra: Record<string, unknown> = {}) {
  return { worldId, rollerName: "Tester", notation, results: [total > 20 ? 20 : total], total, ...extra };
}

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe("session highlights", () => {
  it("403s for a world you don't have access to", async () => {
    const { agent: owner } = await signupAgent("highlightsowner1");
    const world = await owner.post("/api/worlds").send({ name: "Private Highlights World" });
    const worldId = world.body.id as string;

    const { agent: outsider } = await signupAgent("highlightsoutsider1");
    const res = await outsider.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(res.status).toBe(403);
  });

  it("400s a missing or invalid since timestamp", async () => {
    const { agent } = await signupAgent("highlightsbadsince1");
    const world = await agent.post("/api/worlds").send({ name: "Bad Since World" });
    const worldId = world.body.id as string;

    const missing = await agent.get("/api/session-highlights").query({ worldId });
    expect(missing.status).toBe(400);

    const invalid = await agent.get("/api/session-highlights").query({ worldId, since: "not-a-date" });
    expect(invalid.status).toBe(400);
  });

  it("detects natural 20s and natural 1s only on single unmodified d20 rolls", async () => {
    const { agent } = await signupAgent("highlightsnat1");
    const world = await agent.post("/api/worlds").send({ name: "Nat Roll World" });
    const worldId = world.body.id as string;

    await agent.post("/api/roll-log").send({ worldId, rollerName: "A", notation: "1d20", results: [20], total: 20, label: "attack" });
    await agent.post("/api/roll-log").send({ worldId, rollerName: "B", notation: "1d20+5", results: [1], total: 6, label: "save" });
    // Not a nat-20 candidate: multi-die roll, even though it totals 20.
    await agent.post("/api/roll-log").send({ worldId, rollerName: "C", notation: "2d10", results: [10, 10], total: 20, label: "damage" });
    // Not a nat-1 candidate: non-d20 die.
    await agent.post("/api/roll-log").send({ worldId, rollerName: "D", notation: "1d6", results: [1], total: 1, label: "damage" });

    const res = await agent.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(res.status).toBe(200);
    expect(res.body.naturalTwenties.map((r: { rollerName: string }) => r.rollerName)).toEqual(["A"]);
    expect(res.body.naturalOnes.map((r: { rollerName: string }) => r.rollerName)).toEqual(["B"]);
  });

  it("orders top rolls by total descending, capped at 3", async () => {
    const { agent } = await signupAgent("highlightstop1");
    const world = await agent.post("/api/worlds").send({ name: "Top Rolls World" });
    const worldId = world.body.id as string;

    for (const total of [5, 30, 12, 25, 18]) {
      await agent.post("/api/roll-log").send(roll(worldId, "1d20+10", total, { rollerName: `roller-${total}` }));
    }

    const res = await agent.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(res.body.topRolls.map((r: { total: number }) => r.total)).toEqual([30, 25, 18]);
  });

  it("computes gold delta and net item gains within the date filter", async () => {
    const { agent } = await signupAgent("highlightsledger1");
    const world = await agent.post("/api/worlds").send({ name: "Ledger Highlights World" });
    const worldId = world.body.id as string;

    await agent.post("/api/ledger").send({ worldId, kind: "gold", label: "loot", amount: 100, authorName: "DM" });
    await agent.post("/api/ledger").send({ worldId, kind: "gold", label: "spent", amount: -30, authorName: "DM" });
    await agent.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: 3, authorName: "DM" });
    await agent.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: -1, authorName: "DM" });

    const res = await agent.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(res.body.goldDelta).toBe(70);
    expect(res.body.itemsGained).toEqual([{ label: "Potion of Healing", quantity: 2 }]);
  });

  it("excludes entries before the since cutoff", async () => {
    const { agent } = await signupAgent("highlightscutoff1");
    const world = await agent.post("/api/worlds").send({ name: "Cutoff World" });
    const worldId = world.body.id as string;

    await agent.post("/api/roll-log").send(roll(worldId, "1d20", 20, { rollerName: "Late" }));

    const res = await agent.get("/api/session-highlights").query({ worldId, since: TOMORROW });
    expect(res.body.rollCount).toBe(0);
    expect(res.body.naturalTwenties).toEqual([]);
  });

  it("hides a hiddenFromParty roll from a non-owner's highlights but shows it to the owner", async () => {
    const { agent: dm } = await signupAgent("highlightsdm1");
    const world = await dm.post("/api/worlds").send({ name: "Secret Highlights World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("highlightsplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.post("/api/roll-log").send(roll(worldId, "1d20", 20, { rollerName: "DM", hiddenFromParty: true }));

    const playerView = await player.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(playerView.body.naturalTwenties).toEqual([]);

    const dmView = await dm.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(dmView.body.naturalTwenties).toHaveLength(1);
  });
});

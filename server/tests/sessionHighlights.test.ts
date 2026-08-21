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

  it("reports the roller with the most rolls in the period, not the highest total", async () => {
    const { agent } = await signupAgent("highlightsactive1");
    const world = await agent.post("/api/worlds").send({ name: "Active Roller World" });
    const worldId = world.body.id as string;

    // Alice rolls three times (small totals); Bob rolls once with a huge total.
    await agent.post("/api/roll-log").send(roll(worldId, "1d20", 3, { rollerName: "Alice" }));
    await agent.post("/api/roll-log").send(roll(worldId, "1d20", 5, { rollerName: "Alice" }));
    await agent.post("/api/roll-log").send(roll(worldId, "1d20", 8, { rollerName: "Alice" }));
    await agent.post("/api/roll-log").send(roll(worldId, "1d20+50", 70, { rollerName: "Bob" }));

    const res = await agent.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(res.body.mostActiveRoller).toEqual({ rollerName: "Alice", rollCount: 3 });
    // Bob's roll is still the highest total — the two stats measure different things.
    expect(res.body.topRolls[0].rollerName).toBe("Bob");
  });

  it("lists quests marked completed within the period, respecting hiddenFromParty", async () => {
    const { agent: dm } = await signupAgent("highlightsquestdm1");
    const world = await dm.post("/api/worlds").send({ name: "Quest Highlights World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("highlightsquestplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const visible = await dm.post("/api/quests").send({
      title: "Slay the Dragon", questType: "combat", tier: "major", hook: "h", objective: "o", complication: "c", reward: "r", worldId,
    });
    await dm.patch(`/api/quests/${visible.body.id}`).send({ status: "completed" });

    const secret = await dm.post("/api/quests").send({
      title: "Secret DM Plot", questType: "intrigue", tier: "minor", hook: "h", objective: "o", complication: "c", reward: "r", worldId, hiddenFromParty: true,
    });
    await dm.patch(`/api/quests/${secret.body.id}`).send({ status: "completed" });

    const stillActive = await dm.post("/api/quests").send({
      title: "Ongoing Quest", questType: "exploration", tier: "minor", hook: "h", objective: "o", complication: "c", reward: "r", worldId,
    });
    void stillActive;

    const playerView = await player.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(playerView.body.questsCompleted).toEqual([{ title: "Slay the Dragon" }]);

    const dmView = await dm.get("/api/session-highlights").query({ worldId, since: YESTERDAY });
    expect(dmView.body.questsCompleted.map((q: { title: string }) => q.title).sort()).toEqual(["Secret DM Plot", "Slay the Dragon"]);
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

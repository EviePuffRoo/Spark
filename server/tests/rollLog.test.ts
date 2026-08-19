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

function roll(worldId: string, total: number, extra: Record<string, unknown> = {}) {
  return { worldId, rollerName: "Tester", notation: "1d20", results: [total], total, ...extra };
}

describe("roll log", () => {
  it("403s posting or listing for a world you don't have access to", async () => {
    const { agent: owner } = await signupAgent("rollowner1");
    const world = await owner.post("/api/worlds").send({ name: "Private Roll World" });
    const worldId = world.body.id as string;

    const { agent: outsider } = await signupAgent("rolloutsider1");
    const post = await outsider.post("/api/roll-log").send(roll(worldId, 15));
    expect(post.status).toBe(403);

    const list = await outsider.get(`/api/roll-log?worldId=${worldId}`);
    expect(list.status).toBe(403);
  });

  it("hides a hiddenFromParty roll from a non-owner but shows it to the owner", async () => {
    const { agent: dm } = await signupAgent("rolldm1");
    const world = await dm.post("/api/worlds").send({ name: "Secret Roll World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("rollplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.post("/api/roll-log").send(roll(worldId, 7, { hiddenFromParty: true, label: "secret check" }));

    const playerView = await player.get(`/api/roll-log?worldId=${worldId}`);
    expect(playerView.body.map((r: { label: string | null }) => r.label)).not.toContain("secret check");

    const dmView = await dm.get(`/api/roll-log?worldId=${worldId}`);
    expect(dmView.body.map((r: { label: string | null }) => r.label)).toContain("secret check");
  });

  it("403s a free account's history request with a machine-readable code", async () => {
    const { agent } = await signupAgent("rollhistoryfree1");
    const world = await agent.post("/api/worlds").send({ name: "Roll History World" });
    const worldId = world.body.id as string;
    const entry = await agent.post("/api/roll-log").send(roll(worldId, 12));

    const res = await agent.get(`/api/roll-log/history`).query({ worldId, before: entry.body.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("history_paid_only");
  });

  it("pages a paid account back through rolls older than the given cursor, respecting hiddenFromParty", async () => {
    const { agent: dm, userId: dmId } = await signupAgent("rollhistorypaid1");
    await prisma.user.update({ where: { id: dmId }, data: { tier: "paid" } });
    const world = await dm.post("/api/worlds").send({ name: "Paid Roll History World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player, userId: playerId } = await signupAgent("rollhistorypaidplayer1");
    await prisma.user.update({ where: { id: playerId }, data: { tier: "paid" } });
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const first = await dm.post("/api/roll-log").send(roll(worldId, 3, { label: "oldest" }));
    await dm.post("/api/roll-log").send(roll(worldId, 20, { label: "middle-secret", hiddenFromParty: true }));
    const third = await dm.post("/api/roll-log").send(roll(worldId, 11, { label: "newest" }));

    // DM (world owner) sees the hidden roll in the history page.
    const dmPage = await dm.get(`/api/roll-log/history`).query({ worldId, before: third.body.id });
    expect(dmPage.status).toBe(200);
    expect(dmPage.body.map((r: { label: string }) => r.label)).toEqual(["middle-secret", "oldest"]);

    // A paid non-owner player does not see the hidden roll in their history page.
    const playerPage = await player.get(`/api/roll-log/history`).query({ worldId, before: third.body.id });
    expect(playerPage.body.map((r: { label: string }) => r.label)).toEqual(["oldest"]);

    // Paginating "before" the oldest roll returns nothing further back.
    const exhausted = await dm.get(`/api/roll-log/history`).query({ worldId, before: first.body.id });
    expect(exhausted.body).toEqual([]);
  });
});

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

function factionPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Thieves Guild", factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook",
    ...overrides,
  };
}

describe("faction reputation log", () => {
  it("adjusts reputation incrementally and logs delta/reason/author", async () => {
    const { agent } = await signupAgent("factiondm1");
    const create = await agent.post("/api/factions").send(factionPayload());
    const id = create.body.id as string;

    const adjust = await agent.post(`/api/factions/${id}/adjust-reputation`).send({ delta: 10, reason: "Paid off the guild" });
    expect(adjust.status).toBe(200);
    expect(adjust.body.reputation).toBe(10);

    const again = await agent.post(`/api/factions/${id}/adjust-reputation`).send({ delta: -3 });
    expect(again.status).toBe(200);
    expect(again.body.reputation).toBe(7);

    const log = await agent.get(`/api/factions/${id}/reputation-log`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(2);
    expect(log.body[0].delta).toBe(-3);
    expect(log.body[0].reason).toBeUndefined();
    expect(log.body[1].delta).toBe(10);
    expect(log.body[1].reason).toBe("Paid off the guild");
    expect(log.body[1].authorName).toBe("factiondm1");
  });

  it("400s adjust-reputation with a zero or missing delta", async () => {
    const { agent } = await signupAgent("factiondm2");
    const create = await agent.post("/api/factions").send(factionPayload());
    const id = create.body.id as string;

    const zero = await agent.post(`/api/factions/${id}/adjust-reputation`).send({ delta: 0 });
    expect(zero.status).toBe(400);
    const missing = await agent.post(`/api/factions/${id}/adjust-reputation`).send({});
    expect(missing.status).toBe(400);
  });

  it("404s adjust-reputation for a non-owner", async () => {
    const { agent: owner } = await signupAgent("factiondm3");
    const create = await owner.post("/api/factions").send(factionPayload());
    const id = create.body.id as string;

    const { agent: other } = await signupAgent("factiondm4");
    const adjust = await other.post(`/api/factions/${id}/adjust-reputation`).send({ delta: 5 });
    expect(adjust.status).toBe(404);
  });

  it("lets a world member read the reputation log", async () => {
    const { agent: dm } = await signupAgent("factiondm5");
    const world = await dm.post("/api/worlds").send({ name: "Shared World" });
    const worldId = world.body.id as string;
    const create = await dm.post("/api/factions").send(factionPayload({ worldId }));
    const id = create.body.id as string;
    await dm.post(`/api/factions/${id}/adjust-reputation`).send({ delta: 4, reason: "Helped at the gate" });

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("factionplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const log = await player.get(`/api/factions/${id}/reputation-log`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(1);
    expect(log.body[0].reason).toBe("Helped at the gate");
  });

  it("cascade-deletes reputation log entries when the faction is deleted", async () => {
    const { agent } = await signupAgent("factiondm6");
    const create = await agent.post("/api/factions").send(factionPayload());
    const id = create.body.id as string;
    await agent.post(`/api/factions/${id}/adjust-reputation`).send({ delta: 2 });

    await agent.delete(`/api/factions/${id}`);
    const count = await prisma.factionLogEntry.count({ where: { factionId: id } });
    expect(count).toBe(0);
  });
});

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

function factionPayload(name: string, worldId: string) {
  return { name, factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", worldId };
}

describe("faction relationships", () => {
  it("creates a relationship between two factions and lists it for the world", async () => {
    const { agent } = await signupAgent("relationdm1");
    const world = await agent.post("/api/worlds").send({ name: "Relations World" });
    const worldId = world.body.id as string;
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
    const b = await agent.post("/api/factions").send(factionPayload("Merchants Guild", worldId));

    const res = await agent.post("/api/faction-relationships").send({
      worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "rival",
    });
    expect(res.status).toBe(201);
    expect(res.body.stance).toBe("rival");

    const list = await agent.get(`/api/faction-relationships?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("upserts instead of duplicating when the same pair is submitted in either order", async () => {
    const { agent } = await signupAgent("relationdm2");
    const world = await agent.post("/api/worlds").send({ name: "Relations World 2" });
    const worldId = world.body.id as string;
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
    const b = await agent.post("/api/factions").send(factionPayload("Merchants Guild", worldId));

    await agent.post("/api/faction-relationships").send({ worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "rival" });
    const second = await agent.post("/api/faction-relationships").send({ worldId, factionAId: b.body.id, factionBId: a.body.id, stance: "war" });
    expect(second.status).toBe(201);
    expect(second.body.stance).toBe("war");

    const list = await agent.get(`/api/faction-relationships?worldId=${worldId}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].stance).toBe("war");
  });

  it("400s an invalid stance or the same faction on both sides", async () => {
    const { agent } = await signupAgent("relationdm3");
    const world = await agent.post("/api/worlds").send({ name: "Relations World 3" });
    const worldId = world.body.id as string;
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));

    const badStance = await agent.post("/api/faction-relationships").send({ worldId, factionAId: a.body.id, factionBId: a.body.id, stance: "bogus" });
    expect(badStance.status).toBe(400);

    const b = await agent.post("/api/factions").send(factionPayload("Merchants Guild", worldId));
    const sameFaction = await agent.post("/api/faction-relationships").send({ worldId, factionAId: a.body.id, factionBId: a.body.id, stance: "ally" });
    expect(sameFaction.status).toBe(400);
    void b;
  });

  it("404s when a faction doesn't belong to the given world", async () => {
    const { agent } = await signupAgent("relationdm4");
    const world1 = await agent.post("/api/worlds").send({ name: "World A" });
    const world2 = await agent.post("/api/worlds").send({ name: "World B" });
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", world1.body.id));
    const b = await agent.post("/api/factions").send(factionPayload("Merchants Guild", world2.body.id));

    const res = await agent.post("/api/faction-relationships").send({
      worldId: world1.body.id, factionAId: a.body.id, factionBId: b.body.id, stance: "ally",
    });
    expect(res.status).toBe(404);
  });

  it("lets the owner delete a relationship", async () => {
    const { agent } = await signupAgent("relationdm5");
    const world = await agent.post("/api/worlds").send({ name: "Relations World 5" });
    const worldId = world.body.id as string;
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
    const b = await agent.post("/api/factions").send(factionPayload("Merchants Guild", worldId));
    const created = await agent.post("/api/faction-relationships").send({ worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "ally" });

    const del = await agent.delete(`/api/faction-relationships/${created.body.id}`);
    expect(del.status).toBe(204);
    const list = await agent.get(`/api/faction-relationships?worldId=${worldId}`);
    expect(list.body).toHaveLength(0);
  });
});

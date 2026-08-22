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

describe("campaign events", () => {
  it("creates and lists a campaign event for a world", async () => {
    const { agent } = await signupAgent("eventdm1");
    const world = await agent.post("/api/worlds").send({ name: "Event World" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/campaign-events").send({
      worldId, title: "The Docks Change Hands", description: "The Thieves' Guild seized the docks from the Merchants Guild.",
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("The Docks Change Hands");
    expect(res.body.factionId).toBeUndefined();

    const list = await agent.get(`/api/campaign-events?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("round-trips an optional factionId tag when the faction belongs to the world", async () => {
    const { agent } = await signupAgent("eventdm2");
    const world = await agent.post("/api/worlds").send({ name: "Event World 2" });
    const worldId = world.body.id as string;
    const faction = await agent.post("/api/factions").send({
      name: "Thieves Guild", factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", worldId,
    });

    const res = await agent.post("/api/campaign-events").send({
      worldId, title: "Guild War", description: "Open conflict breaks out.", factionId: faction.body.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.factionId).toBe(faction.body.id);
  });

  it("403s a factionId tag for a faction outside the given world", async () => {
    const { agent } = await signupAgent("eventdm3");
    const world1 = await agent.post("/api/worlds").send({ name: "World A" });
    const world2 = await agent.post("/api/worlds").send({ name: "World B" });
    const faction = await agent.post("/api/factions").send({
      name: "Thieves Guild", factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", worldId: world1.body.id,
    });

    const res = await agent.post("/api/campaign-events").send({
      worldId: world2.body.id, title: "Guild War", description: "Open conflict breaks out.", factionId: faction.body.id,
    });
    expect(res.status).toBe(403);
  });

  it("400s missing title or description", async () => {
    const { agent } = await signupAgent("eventdm4");
    const world = await agent.post("/api/worlds").send({ name: "Event World 4" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/campaign-events").send({ worldId, title: "", description: "" });
    expect(res.status).toBe(400);
  });

  it("403s a non-member from creating or listing events for a world", async () => {
    const { agent: owner } = await signupAgent("eventdm5");
    const world = await owner.post("/api/worlds").send({ name: "Event World 5" });
    const worldId = world.body.id as string;

    const { agent: outsider } = await signupAgent("eventoutsider1");
    const create = await outsider.post("/api/campaign-events").send({ worldId, title: "T", description: "D" });
    expect(create.status).toBe(403);
    const list = await outsider.get(`/api/campaign-events?worldId=${worldId}`);
    expect(list.status).toBe(403);
  });

  it("lets a world member list events, and lets the owner delete one", async () => {
    const { agent: dm } = await signupAgent("eventdm6");
    const world = await dm.post("/api/worlds").send({ name: "Event World 6" });
    const worldId = world.body.id as string;
    const created = await dm.post("/api/campaign-events").send({ worldId, title: "T", description: "D" });

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("eventplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const list = await player.get(`/api/campaign-events?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const deleteByPlayer = await player.delete(`/api/campaign-events/${created.body.id}`);
    expect(deleteByPlayer.status).toBe(404);

    const deleteByOwner = await dm.delete(`/api/campaign-events/${created.body.id}`);
    expect(deleteByOwner.status).toBe(204);
  });
});

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

function questPayload(title: string, worldId?: string) {
  return {
    title, questType: "rescue", tier: "local", hook: "hook", objective: "objective",
    complication: "complication", reward: "reward",
    ...(worldId ? { worldId } : {}),
  };
}

async function publishQuest(agent: request.Agent, title: string, worldId?: string) {
  const quest = await agent.post("/api/quests").send(questPayload(title, worldId));
  const publish = await agent.post("/api/public").send({ entityType: "quest", entityId: quest.body.id, title });
  return { questId: quest.body.id as string, entryId: publish.body.id as string };
}

describe("guild board (cross-table quest claims)", () => {
  it("claims a published quest into the claimer's own roster, unassigned to any world", async () => {
    const { agent: poster } = await signupAgent("guildposter1");
    const world = await poster.post("/api/worlds").send({ name: "Poster World" });
    const { entryId, questId } = await publishQuest(poster, "Retrieve the Lost Signet", world.body.id);

    const { agent: claimer } = await signupAgent("guildclaimer1");
    const claim = await claimer.post(`/api/public/${entryId}/claim-quest`);
    expect(claim.status).toBe(201);
    expect(claim.body.id).not.toBe(questId);

    const claimed = await claimer.get(`/api/quests/${claim.body.id}`);
    expect(claimed.status).toBe(200);
    expect(claimed.body.title).toBe("Retrieve the Lost Signet");
    expect(claimed.body.worldId).toBeNull();
  });

  it("400s claiming a non-quest entity type", async () => {
    const { agent: poster } = await signupAgent("guildposter2");
    const faction = await poster.post("/api/factions").send({ name: "Guild", factionType: "trade", agenda: "profit", methods: "trade", publicFace: "merchants", hook: "hook" });
    const publish = await poster.post("/api/public").send({ entityType: "faction", entityId: faction.body.id, title: "A Faction" });

    const { agent: claimer } = await signupAgent("guildclaimer2");
    const res = await claimer.post(`/api/public/${publish.body.id}/claim-quest`);
    expect(res.status).toBe(400);
  });

  it("writes exactly one campaign event into the poster's world when the claimer completes their claimed copy", async () => {
    const { agent: poster } = await signupAgent("guildposter3");
    const world = await poster.post("/api/worlds").send({ name: "Poster World 3" });
    const worldId = world.body.id as string;
    const { entryId } = await publishQuest(poster, "Clear the Old Mill", worldId);

    const { agent: claimer } = await signupAgent("guildclaimer3");
    const claim = await claimer.post(`/api/public/${entryId}/claim-quest`);
    const claimedId = claim.body.id as string;

    const complete = await claimer.patch(`/api/quests/${claimedId}`).send({ status: "completed" });
    expect(complete.status).toBe(200);

    const events = await prisma.campaignEvent.findMany({ where: { worldId } });
    expect(events).toHaveLength(1);
    expect(events[0].description).toContain("Clear the Old Mill");
    expect(events[0].userId).toBe((await prisma.user.findUniqueOrThrow({ where: { username: "guildposter3" } })).id);

    const posterEvents = await poster.get(`/api/campaign-events?worldId=${worldId}`);
    expect(posterEvents.status).toBe(200);
    expect(posterEvents.body).toHaveLength(1);
  });

  it("never fires a second event if the claimed quest is completed more than once", async () => {
    const { agent: poster } = await signupAgent("guildposter4");
    const world = await poster.post("/api/worlds").send({ name: "Poster World 4" });
    const worldId = world.body.id as string;
    const { entryId } = await publishQuest(poster, "Escort the Caravan", worldId);

    const { agent: claimer } = await signupAgent("guildclaimer4");
    const claim = await claimer.post(`/api/public/${entryId}/claim-quest`);
    const claimedId = claim.body.id as string;

    await claimer.patch(`/api/quests/${claimedId}`).send({ status: "completed" });
    await claimer.patch(`/api/quests/${claimedId}`).send({ status: "active" });
    await claimer.patch(`/api/quests/${claimedId}`).send({ status: "completed" });

    const events = await prisma.campaignEvent.findMany({ where: { worldId } });
    expect(events).toHaveLength(1);
  });

  it("does not notify anywhere if the published quest was never assigned to a world", async () => {
    const { agent: poster } = await signupAgent("guildposter5");
    const { entryId } = await publishQuest(poster, "Unassigned Quest");

    const { agent: claimer } = await signupAgent("guildclaimer5");
    const claim = await claimer.post(`/api/public/${entryId}/claim-quest`);
    const complete = await claimer.patch(`/api/quests/${claim.body.id}`).send({ status: "completed" });
    expect(complete.status).toBe(200);

    const allEvents = await prisma.campaignEvent.findMany();
    expect(allEvents).toHaveLength(0);
  });

  it("never exposes the poster's world or other quests to the claimer beyond the published entry", async () => {
    const { agent: poster } = await signupAgent("guildposter6");
    const world = await poster.post("/api/worlds").send({ name: "Poster World 6" });
    const worldId = world.body.id as string;
    const { entryId } = await publishQuest(poster, "Public Quest", worldId);
    // A second, unpublished quest in the same world — must stay invisible.
    await poster.post("/api/quests").send(questPayload("Secret Quest", worldId));

    const { agent: claimer } = await signupAgent("guildclaimer6");
    await claimer.post(`/api/public/${entryId}/claim-quest`);

    const worldAccess = await claimer.get(`/api/worlds/${worldId}`);
    expect([403, 404]).toContain(worldAccess.status);

    const questList = await claimer.get(`/api/quests?worldId=${worldId}`);
    expect(questList.status).toBe(200);
    expect(questList.body).toHaveLength(0);
  });

  it("never lets the claimer write directly into the poster's world outside the completion callback", async () => {
    const { agent: poster } = await signupAgent("guildposter7");
    const world = await poster.post("/api/worlds").send({ name: "Poster World 7" });
    const worldId = world.body.id as string;
    const { entryId } = await publishQuest(poster, "Yet Another Quest", worldId);

    const { agent: claimer } = await signupAgent("guildclaimer7");
    await claimer.post(`/api/public/${entryId}/claim-quest`);

    const forgedEvent = await claimer.post("/api/campaign-events").send({ worldId, title: "Forged", description: "Should not be allowed" });
    expect(forgedEvent.status).toBe(403);
  });
});

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

function charPayload(name: string, worldId?: string) {
  return {
    kind: "npc", name, alignment: "Neutral", templateId: "guard", templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", xp: 25, proficiencyBonus: 2, senses: "passive Perception 10", languages: "Common", traits: [], actions: [] },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
    ...(worldId ? { worldId } : {}),
  };
}

function factionPayload(name: string, worldId?: string) {
  return { name, factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", ...(worldId ? { worldId } : {}) };
}

const PC_BODY = { name: "Aria", className: "Fighter", level: 1, race: "Human", armorClass: 15, maxHp: 12 };

// This entire suite is exercising a pure dual-write: every one of these
// call sites already has its own behavior fully covered by its own test
// file (characters.test.ts, factions.test.ts, worldTick.test.ts, etc.) —
// these tests only check that the new, additive CampaignEventLog table
// picks up a mirrored row alongside each existing write, not that the
// existing write itself behaves correctly (already proven elsewhere).
describe("campaign event log (unified dual-write)", () => {
  it("mirrors a general disposition adjustment", async () => {
    const { agent } = await signupAgent("logdm1");
    const world = await agent.post("/api/worlds").send({ name: "Log World 1" });
    const worldId = world.body.id as string;
    const character = await agent.post("/api/characters").send(charPayload("Old Man Willow", worldId));

    await agent.post(`/api/characters/${character.body.id}/adjust-disposition`).send({ delta: 6, reason: "Kind words" });

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("disposition");
    expect(rows[0].eventType).toBe("disposition.adjusted");
    expect(rows[0].entityId).toBe(character.body.id);
    const payload = JSON.parse(rows[0].payload);
    expect(payload.delta).toBe(6);
    expect(payload.reason).toBe("Kind words");
    expect(payload.playerCharacterId).toBeUndefined();
  });

  it("mirrors a per-PC disposition adjustment with a distinct event type", async () => {
    const { agent } = await signupAgent("logdm2");
    const world = await agent.post("/api/worlds").send({ name: "Log World 2" });
    const worldId = world.body.id as string;
    const character = await agent.post("/api/characters").send(charPayload("Old Man Willow", worldId));
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId });

    await agent.post(`/api/characters/${character.body.id}/adjust-disposition`).send({ delta: 4, playerCharacterId: pc.body.id });

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe("disposition.adjustedForPc");
    const payload = JSON.parse(rows[0].payload);
    expect(payload.playerCharacterId).toBe(pc.body.id);
  });

  it("mirrors a faction reputation adjustment", async () => {
    const { agent } = await signupAgent("logdm3");
    const world = await agent.post("/api/worlds").send({ name: "Log World 3" });
    const worldId = world.body.id as string;
    const faction = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));

    await agent.post(`/api/factions/${faction.body.id}/adjust-reputation`).send({ delta: -5, reason: "Botched heist" });

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("factionReputation");
    expect(rows[0].eventType).toBe("faction.reputationChanged");
    const payload = JSON.parse(rows[0].payload);
    expect(payload.delta).toBe(-5);
  });

  it("mirrors a manually logged campaign event", async () => {
    const { agent } = await signupAgent("logdm4");
    const world = await agent.post("/api/worlds").send({ name: "Log World 4" });
    const worldId = world.body.id as string;

    await agent.post("/api/campaign-events").send({ worldId, title: "The Docks Change Hands", description: "A quiet coup." });

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("campaignEvent");
    expect(rows[0].eventType).toBe("campaignEvent.logged");
    const payload = JSON.parse(rows[0].payload);
    expect(payload.title).toBe("The Docks Change Hands");
  });

  it("has no worldId on a disposition adjustment for a character unassigned to any world", async () => {
    const { agent } = await signupAgent("logdm5");
    const character = await agent.post("/api/characters").send(charPayload("Wandering NPC"));

    await agent.post(`/api/characters/${character.body.id}/adjust-disposition`).send({ delta: 2 });

    const rows = await prisma.campaignEventLog.findMany({ where: { entityId: character.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].worldId).toBeNull();
  });

  it("mirrors a full World Tick apply as one row per faction/character/event delta plus one whole-tick summary row", async () => {
    const { agent, userId } = await signupAgent("logdm6");
    // Applying a World Tick is a paid feature; this test is about the
    // campaign-event-log mirroring the apply causes, not the gate itself.
    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
    const world = await agent.post("/api/worlds").send({ name: "Log World 6" });
    const worldId = world.body.id as string;
    const a = await agent.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
    const b = await agent.post("/api/factions").send(factionPayload("City Watch", worldId));
    await agent.post("/api/faction-relationships").send({ worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "war" });
    const character = await agent.post("/api/characters").send(charPayload("Grix", worldId));
    await agent.patch(`/api/characters/${character.body.id}`).send({ factionId: a.body.id });
    await agent.post(`/api/worlds/${worldId}/advance-day`).send({ days: 14 });

    const proposal = (await agent.get(`/api/world-tick/${worldId}/proposal`)).body;
    const applyRes = await agent.post(`/api/world-tick/${worldId}/apply`).send({
      worldId, fromDay: proposal.fromDay, toDay: proposal.toDay, items: proposal.items,
    });
    expect(applyRes.status).toBe(201);

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    // One mirrored row per applied delta item, plus exactly one final
    // "worldTick.applied" summary row for the whole batch.
    expect(rows.filter((r) => r.eventType === "worldTick.applied")).toHaveLength(1);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((r) => r.entityType === "factionReputation")).toBe(true);
    expect(rows.some((r) => r.entityType === "disposition")).toBe(true);
  });

  it("serves a paginated GET /worlds/:id timeline, owner-or-member gated", async () => {
    const { agent: dm } = await signupAgent("logdm7");
    const world = await dm.post("/api/worlds").send({ name: "Log World 7" });
    const worldId = world.body.id as string;
    const character = await dm.post("/api/characters").send(charPayload("Old Man Willow", worldId));

    for (let i = 0; i < 3; i++) {
      await dm.post(`/api/characters/${character.body.id}/adjust-disposition`).send({ delta: 1 });
    }

    const missing = await dm.get("/api/campaign-event-log");
    expect(missing.status).toBe(400);

    const firstPage = await dm.get(`/api/campaign-event-log?worldId=${worldId}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.entries).toHaveLength(3);
    expect(firstPage.body.entries[0].eventType).toBe("disposition.adjusted");
    expect(firstPage.body.nextCursor).toBeNull();

    const { agent: outsider } = await signupAgent("logoutsider1");
    const denied = await outsider.get(`/api/campaign-event-log?worldId=${worldId}`);
    expect(denied.status).toBe(403);
  });

  it("mirrors the Guild Board completion callback into the poster's world", async () => {
    const { agent: poster } = await signupAgent("logposter1");
    const world = await poster.post("/api/worlds").send({ name: "Poster World" });
    const worldId = world.body.id as string;
    const quest = await poster.post("/api/quests").send({
      title: "Recover the Lost Bell", questType: "retrieval", tier: "local", hook: "hook", objective: "objective",
      complication: "complication", reward: "reward", worldId,
    });
    const publish = await poster.post("/api/public").send({ entityType: "quest", entityId: quest.body.id, title: "Recover the Lost Bell" });

    const { agent: claimer } = await signupAgent("logclaimer1");
    const claim = await claimer.post(`/api/public/${publish.body.id}/claim-quest`);
    await claimer.patch(`/api/quests/${claim.body.id}`).send({ status: "completed" });

    const rows = await prisma.campaignEventLog.findMany({ where: { worldId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("campaignEvent");
    const payload = JSON.parse(rows[0].payload);
    expect(payload.title).toContain("answers the call");
  });
});

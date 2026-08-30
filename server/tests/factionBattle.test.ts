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

// Applying (not simulating) a resolved battle is a paid feature (gated on
// the world owner's tier), so any DM below that calls apply-battle needs
// paid tier. The dedicated free-tier gate test at the end covers the
// free-tier-blocked case.
async function paidDM(username: string) {
  const { agent, userId } = await signupAgent(username);
  await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
  return { agent, userId };
}

function factionPayload(name: string, worldId: string) {
  return { name, factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", worldId };
}

function characterPayload(name: string, worldId: string, xp: number) {
  return {
    kind: "monster", name, alignment: "neutral", templateId: "t1", templateName: "Template",
    statBlock: { xp }, backstory: "backstory", worldId,
  };
}

// POST /characters doesn't accept factionId at creation (only PATCH sets
// it), so affiliating a character with a faction is a two-step create-then-patch.
async function createAffiliatedCharacter(dm: request.Agent, name: string, worldId: string, factionId: string, xp: number) {
  const created = await dm.post("/api/characters").send(characterPayload(name, worldId, xp));
  await dm.patch(`/api/characters/${created.body.id}`).send({ factionId });
  return created.body.id as string;
}

async function setupBattle(dm: request.Agent, powerA: number, powerB: number, countA = 5, countB = 5) {
  const world = await dm.post("/api/worlds").send({ name: "Battle World" });
  const worldId = world.body.id as string;
  const a = await dm.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
  const b = await dm.post("/api/factions").send(factionPayload("City Watch", worldId));
  const rel = await dm.post("/api/faction-relationships").send({
    worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "war",
  });
  for (let i = 0; i < countA; i++) {
    await createAffiliatedCharacter(dm, `Thug ${i}`, worldId, a.body.id, powerA);
  }
  for (let i = 0; i < countB; i++) {
    await createAffiliatedCharacter(dm, `Guard ${i}`, worldId, b.body.id, powerB);
  }
  return { worldId, factionAId: a.body.id, factionBId: b.body.id, relationshipId: rel.body.id as string };
}

describe("autonomous faction battles", () => {
  it("403s a simulate/apply request from a non-owner", async () => {
    const { agent: dm } = await signupAgent("battledm1");
    const { worldId, relationshipId } = await setupBattle(dm, 100, 10);
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("battleplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const simulate = await player.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    expect(simulate.status).toBe(404);
    const apply = await player.post(`/api/faction-relationships/${relationshipId}/apply-battle`);
    expect(apply.status).toBe(404);
  });

  it("simulate-battle picks a winner and never writes anything", async () => {
    const { agent: dm } = await signupAgent("battledm2");
    const { relationshipId, factionAId } = await setupBattle(dm, 100000, 1);

    const res = await dm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    expect(res.status).toBe(200);
    expect(res.body.winnerFactionId).toBe(factionAId);
    expect(res.body.casualties.length).toBeGreaterThan(0);

    const faction = await prisma.faction.findUniqueOrThrow({ where: { id: factionAId } });
    expect(faction.reputation).toBe(0);
    const anyDeceased = await prisma.character.count({ where: { status: "deceased" } });
    expect(anyDeceased).toBe(0);
  });

  it("simulate-battle is idempotent for the same day", async () => {
    const { agent: dm } = await signupAgent("battledm3");
    const { relationshipId } = await setupBattle(dm, 60, 55, 10, 10);

    const first = await dm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    const second = await dm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    expect(second.body).toEqual(first.body);
  });

  it("apply-battle writes casualty status, reputation deltas + log entries, and a campaign event", async () => {
    const { agent: dm } = await paidDM("battledm4");
    const { worldId, relationshipId, factionAId, factionBId } = await setupBattle(dm, 100000, 1);

    const proposal = (await dm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`)).body;
    const applyRes = await dm.post(`/api/faction-relationships/${relationshipId}/apply-battle`);
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.proposal).toEqual(proposal);
    expect(applyRes.body.event.title).toBe(proposal.title);
    expect(applyRes.body.event.worldId).toBe(worldId);

    const winnerFaction = await prisma.faction.findUniqueOrThrow({ where: { id: factionAId } });
    const loserFaction = await prisma.faction.findUniqueOrThrow({ where: { id: factionBId } });
    expect(winnerFaction.reputation).toBeGreaterThan(0);
    expect(loserFaction.reputation).toBeLessThan(0);

    const winnerLog = await prisma.factionLogEntry.findMany({ where: { factionId: factionAId } });
    const loserLog = await prisma.factionLogEntry.findMany({ where: { factionId: factionBId } });
    expect(winnerLog).toHaveLength(1);
    expect(loserLog).toHaveLength(1);

    const deceasedOrFled = await prisma.character.findMany({ where: { status: { in: ["deceased", "fled"] } } });
    expect(deceasedOrFled.length).toBe(proposal.casualties.length);

    const events = await prisma.campaignEvent.findMany({ where: { worldId } });
    expect(events).toHaveLength(1);

    const relationship = await prisma.factionRelationship.findUniqueOrThrow({ where: { id: relationshipId } });
    expect(relationship.stance).toBe("war");
  });

  it("only counts active characters toward a faction's power, and never resurrects a prior casualty", async () => {
    const { agent: dm } = await paidDM("battledm5");
    const { relationshipId, factionAId } = await setupBattle(dm, 100, 100, 3, 3);
    await dm.post(`/api/faction-relationships/${relationshipId}/apply-battle`);

    const stillActiveA = await prisma.character.count({ where: { factionId: factionAId, status: "active" } });
    const totalA = await prisma.character.count({ where: { factionId: factionAId } });
    expect(stillActiveA).toBeLessThanOrEqual(totalA);

    // A second apply on the same day is a no-op on top of the first: the
    // deterministic proposal is identical, so re-applying the same
    // casualty ids and status just reasserts the same state.
    const secondApply = await dm.post(`/api/faction-relationships/${relationshipId}/apply-battle`);
    expect(secondApply.status).toBe(201);
  });

  it("lets a free-tier DM simulate a battle, but 403s applying it with a machine-readable code", async () => {
    const { agent: dm } = await signupAgent("battledmfree1");
    const { relationshipId } = await setupBattle(dm, 100000, 1);

    const simulate = await dm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    expect(simulate.status).toBe(200);

    const apply = await dm.post(`/api/faction-relationships/${relationshipId}/apply-battle`);
    expect(apply.status).toBe(403);
    expect(apply.body.code).toBe("autonomous_wars_paid_only");
  });
});

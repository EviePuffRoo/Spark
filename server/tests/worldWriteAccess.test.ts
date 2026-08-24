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

function charPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "npc",
    name: "Test NPC",
    alignment: "Neutral",
    templateId: "guard",
    templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", proficiencyBonus: 2, actions: [] },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
    ...overrides,
  };
}

async function joinAsRole(dm: request.Agent, worldId: string, role: "player" | "coDM", playerAgent: request.Agent) {
  const code = await dm.post(`/api/worlds/${worldId}/join-code`).send({ role });
  await playerAgent.post("/api/worlds/join").send({ code: code.body.code });
}

describe("world write access — co-DM vs player vs non-member", () => {
  it("lets a coDM edit and delete another user's character in a shared world", async () => {
    const { agent: dm } = await signupAgent("wwadm1");
    const world = await dm.post("/api/worlds").send({ name: "CoDM Write World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwacodm1");
    await joinAsRole(dm, worldId, "coDM", coDm);

    const char = await dm.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    const patched = await coDm.patch(`/api/characters/${charId}`).send({ name: "Renamed by coDM" });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe("Renamed by coDM");

    const deleted = await coDm.delete(`/api/characters/${charId}`);
    expect(deleted.status).toBe(204);
  });

  it("blocks a plain player-role member from editing or deleting an entity", async () => {
    const { agent: dm } = await signupAgent("wwadm2");
    const world = await dm.post("/api/worlds").send({ name: "Player Blocked World" });
    const worldId = world.body.id as string;
    const { agent: player } = await signupAgent("wwaplayer2");
    await joinAsRole(dm, worldId, "player", player);

    const char = await dm.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    const patched = await player.patch(`/api/characters/${charId}`).send({ name: "Should not work" });
    expect(patched.status).toBe(404);

    const deleted = await player.delete(`/api/characters/${charId}`);
    expect(deleted.status).toBe(404);
  });

  it("blocks a non-member from writing entirely", async () => {
    const { agent: dm } = await signupAgent("wwadm3");
    const world = await dm.post("/api/worlds").send({ name: "Non-Member World" });
    const worldId = world.body.id as string;
    const char = await dm.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    const { agent: outsider } = await signupAgent("wwaoutsider3");
    const patched = await outsider.patch(`/api/characters/${charId}`).send({ name: "Nope" });
    expect(patched.status).toBe(404);
  });

  it("lets a coDM adjust faction reputation via the smart endpoint", async () => {
    const { agent: dm } = await signupAgent("wwadm4");
    const world = await dm.post("/api/worlds").send({ name: "Faction Write World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwacodm4");
    await joinAsRole(dm, worldId, "coDM", coDm);

    const faction = await dm.post("/api/factions").send({
      name: "Test Faction", factionType: "guild", agenda: "profit", methods: "trade", publicFace: "merchants", hook: "a deal", worldId,
    });
    const factionId = faction.body.id as string;

    const adjusted = await coDm.post(`/api/factions/${factionId}/adjust-reputation`).send({ delta: 5 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.reputation).toBe(5);
  });

  it("lets a coDM PATCH the world and advance the calendar, but not manage members or delete the world", async () => {
    const { agent: dm } = await signupAgent("wwadm5");
    const world = await dm.post("/api/worlds").send({ name: "World Admin Boundary" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwacodm5");
    await joinAsRole(dm, worldId, "coDM", coDm);

    const patched = await coDm.patch(`/api/worlds/${worldId}`).send({ description: "Updated by coDM" });
    expect(patched.status).toBe(200);
    expect(patched.body.description).toBe("Updated by coDM");

    const advanced = await coDm.post(`/api/worlds/${worldId}/advance-day`).send({ days: 2 });
    expect(advanced.status).toBe(200);
    expect(advanced.body.currentDay).toBe(3);

    expect((await coDm.post(`/api/worlds/${worldId}/join-code`)).status).toBe(404);
    const { userId: playerId } = await signupAgent("wwaplayer5b");
    expect((await coDm.patch(`/api/worlds/${worldId}/members/${playerId}`).send({ role: "coDM" })).status).toBe(404);
    expect((await coDm.delete(`/api/worlds/${worldId}`)).status).toBe(404);
  });
});

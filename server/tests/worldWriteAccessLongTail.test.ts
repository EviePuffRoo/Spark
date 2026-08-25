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

async function joinAsRole(dm: request.Agent, worldId: string, role: "player" | "coDM", playerAgent: request.Agent) {
  const code = await dm.post(`/api/worlds/${worldId}/join-code`).send({ role });
  await playerAgent.post("/api/worlds/join").send({ code: code.body.code });
}

function charPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "npc",
    name: "Battle Grunt",
    alignment: "Neutral",
    templateId: "guard",
    templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", proficiencyBonus: 2, actions: [], xp: 25 },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
    ...overrides,
  };
}

describe("world write access — Organizations Phase B, 1b long-tail entities", () => {
  it("lets a coDM edit and delete a session note in a shared world, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwltdm1");
    const world = await dm.post("/api/worlds").send({ name: "Session Notes World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwltcodm1");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwltplayer1");
    await joinAsRole(dm, worldId, "player", player);

    const note = await dm.post("/api/session-notes").send({ title: "Session 1", summary: "The party arrived.", worldId });
    const noteId = note.body.id as string;

    const patched = await coDm.patch(`/api/session-notes/${noteId}`).send({ title: "Session 1 (Recap)" });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe("Session 1 (Recap)");

    expect((await player.patch(`/api/session-notes/${noteId}`).send({ title: "Nope" })).status).toBe(404);

    const deleted = await coDm.delete(`/api/session-notes/${noteId}`);
    expect(deleted.status).toBe(204);
  });

  it("lets a coDM create, advance, and delete a doom clock, blocks a plain player from creating one", async () => {
    const { agent: dm } = await signupAgent("wwltdm2");
    const world = await dm.post("/api/worlds").send({ name: "Doom Clock World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwltcodm2");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwltplayer2");
    await joinAsRole(dm, worldId, "player", player);

    const created = await coDm.post("/api/doom-clocks").send({ worldId, label: "Ritual Countdown", segments: 6 });
    expect(created.status).toBe(201);
    const clockId = created.body.id as string;

    expect((await player.post("/api/doom-clocks").send({ worldId, label: "Should not work", segments: 4 })).status).toBe(403);

    const advanced = await coDm.post(`/api/doom-clocks/${clockId}/advance`).send({ amount: 2 });
    expect(advanced.status).toBe(200);
    expect(advanced.body.filled).toBe(2);

    expect((await coDm.delete(`/api/doom-clocks/${clockId}`)).status).toBe(204);
  });

  it("lets a coDM rest and level up a player character owned by someone else in the world", async () => {
    const { agent: dm } = await signupAgent("wwltdm3");
    const world = await dm.post("/api/worlds").send({ name: "PC Write World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwltcodm3");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwltplayer3");
    await joinAsRole(dm, worldId, "player", player);

    const pc = await player.post("/api/player-characters").send({
      name: "Aria", className: "Fighter", level: 1, race: "Human", armorClass: 15, maxHp: 12,
      abilityScores: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, worldId,
    });
    const pcId = pc.body.id as string;

    const rested = await coDm.post(`/api/player-characters/${pcId}/rest`).send({ kind: "long" });
    expect(rested.status).toBe(200);
    expect(rested.body.currentHp).toBe(12);

    const leveledUp = await coDm.post(`/api/player-characters/${pcId}/level-up`).send({ toLevel: 2 });
    expect(leveledUp.status).toBe(200);
    expect(leveledUp.body.level).toBe(2);

    const { agent: outsider } = await signupAgent("wwltoutsider3");
    expect((await outsider.post(`/api/player-characters/${pcId}/rest`).send({ kind: "long" })).status).toBe(404);
  });

  it("resolves a faction relationship battle using both factions' affiliated characters regardless of who created them", async () => {
    const { agent: dm } = await signupAgent("wwltdm4");
    const world = await dm.post("/api/worlds").send({ name: "Battle World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwltcodm4");
    await joinAsRole(dm, worldId, "coDM", coDm);

    const factionA = await dm.post("/api/factions").send({
      name: "Iron Legion", factionType: "military", agenda: "conquest", methods: "force", publicFace: "soldiers", hook: "war", worldId,
    });
    const factionB = await dm.post("/api/factions").send({
      name: "Shadow Cabal", factionType: "cult", agenda: "secrecy", methods: "subterfuge", publicFace: "merchants", hook: "plot", worldId,
    });

    // One combatant created by the DM, one by the coDM — both should count.
    // factionId can only be set via PATCH (POST /characters doesn't accept
    // it), so create-then-patch each into its faction.
    const soldier = await dm.post("/api/characters").send(charPayload({ worldId, name: "Legion Soldier" }));
    await dm.patch(`/api/characters/${soldier.body.id}`).send({ factionId: factionA.body.id });
    const agentChar = await coDm.post("/api/characters").send(charPayload({ worldId, name: "Cabal Agent" }));
    await coDm.patch(`/api/characters/${agentChar.body.id}`).send({ factionId: factionB.body.id });

    const relationship = await coDm.post("/api/faction-relationships").send({
      worldId, factionAId: factionA.body.id, factionBId: factionB.body.id, stance: "war",
    });
    expect(relationship.status).toBe(201);
    const relationshipId = relationship.body.id as string;

    // Both sides have one affiliated, active character (one created by the
    // DM, one by the coDM) — since neither side's power is zero, this can
    // never resolve as a stalemate. A stalemate is the only outcome that
    // reports reputationDeltas: [] and winnerFactionId: null, so this
    // indirectly confirms loadBattleSide is scoping by worldId rather than
    // by whichever account happened to call the endpoint (the coDM here) —
    // the bug this fix targeted.
    const proposal = await coDm.get(`/api/faction-relationships/${relationshipId}/simulate-battle`);
    expect(proposal.status).toBe(200);
    expect(proposal.body.winnerFactionId).not.toBeNull();
    expect(proposal.body.reputationDeltas.length).toBe(2);

    const { agent: outsider } = await signupAgent("wwltoutsider4");
    expect((await outsider.get(`/api/faction-relationships/${relationshipId}/simulate-battle`)).status).toBe(404);

    expect((await coDm.delete(`/api/faction-relationships/${relationshipId}`)).status).toBe(204);
  });
});

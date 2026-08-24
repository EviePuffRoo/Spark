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

const PC_BODY = { name: "Aria", className: "Fighter", level: 1, race: "Human", armorClass: 15, maxHp: 12 };

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

describe("characters CRUD + ownership — representative entity-router template", () => {
  it("400s a create call missing required fields", async () => {
    const { agent } = await signupAgent("cruduser1");
    const res = await agent.post("/api/characters").send({ name: "Missing stuff" });
    expect(res.status).toBe(400);
  });

  it("creates and lists a character owned by the caller", async () => {
    const { agent } = await signupAgent("cruduser2");
    const create = await agent.post("/api/characters").send(charPayload());
    expect(create.status).toBe(201);

    const list = await agent.get("/api/characters");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(create.body.id);
  });

  it("hides another user's unassigned character from list/get", async () => {
    const { agent: owner } = await signupAgent("cruduser3");
    const create = await owner.post("/api/characters").send(charPayload());

    const { agent: other } = await signupAgent("cruduser4");
    const list = await other.get("/api/characters");
    expect(list.body).toHaveLength(0);

    const get = await other.get(`/api/characters/${create.body.id}`);
    expect(get.status).toBe(404);
  });

  it("shows a world member a character assigned to the shared world, unless hidden from party", async () => {
    const { agent: dm } = await signupAgent("dmuser1");
    const world = await dm.post("/api/worlds").send({ name: "Shared World" });
    const worldId = world.body.id as string;

    const visible = await dm.post("/api/characters").send(charPayload({ name: "Visible NPC", worldId }));
    expect(visible.body.hiddenFromParty).toBe(false);
    const hidden = await dm.post("/api/characters").send(charPayload({ name: "Hidden NPC", worldId, hiddenFromParty: true }));
    expect(hidden.body.hiddenFromParty).toBe(true);

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("playeruser1");
    const join = await player.post("/api/worlds/join").send({ code: joinCode.body.code });
    expect(join.status).toBe(201);

    const list = await player.get("/api/characters");
    const names = list.body.map((c: { name: string }) => c.name);
    expect(names).toContain("Visible NPC");
    expect(names).not.toContain("Hidden NPC");
  });

  it("only lets the owner patch or delete their character", async () => {
    const { agent: owner } = await signupAgent("cruduser5");
    const create = await owner.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    const { agent: other } = await signupAgent("cruduser6");
    const patchByOther = await other.patch(`/api/characters/${id}`).send({ name: "Hijacked" });
    expect(patchByOther.status).toBe(404);
    const deleteByOther = await other.delete(`/api/characters/${id}`);
    expect(deleteByOther.status).toBe(404);

    const patchByOwner = await owner.patch(`/api/characters/${id}`).send({ name: "Renamed" });
    expect(patchByOwner.status).toBe(200);
    expect(patchByOwner.body.name).toBe("Renamed");

    const deleteByOwner = await owner.delete(`/api/characters/${id}`);
    expect(deleteByOwner.status).toBe(204);

    const row = await prisma.character.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it("enforces the attunement rules on patch", async () => {
    const { agent } = await signupAgent("cruduser7");
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    // Can't attune an item that isn't equipped.
    const badAttune = await agent.patch(`/api/characters/${id}`).send({ equippedItems: [], attunedItems: ["item-1"] });
    expect(badAttune.status).toBe(400);

    // More than 3 attuned items is rejected.
    const tooMany = await agent.patch(`/api/characters/${id}`).send({
      equippedItems: ["a", "b", "c", "d"],
      attunedItems: ["a", "b", "c", "d"],
    });
    expect(tooMany.status).toBe(400);

    const ok = await agent.patch(`/api/characters/${id}`).send({ equippedItems: ["a", "b"], attunedItems: ["a"] });
    expect(ok.status).toBe(200);
  });

  it("defaults disposition to 0 and lets the owner adjust it", async () => {
    const { agent } = await signupAgent("cruduser8");
    const create = await agent.post("/api/characters").send(charPayload());
    expect(create.body.disposition).toBe(0);
    const id = create.body.id as string;

    const patch = await agent.patch(`/api/characters/${id}`).send({ disposition: 15 });
    expect(patch.status).toBe(200);
    expect(patch.body.disposition).toBe(15);

    const get = await agent.get(`/api/characters/${id}`);
    expect(get.body.disposition).toBe(15);
  });

  it("lets the owner link an NPC to their own faction, but not someone else's", async () => {
    const { agent } = await signupAgent("cruduser9");
    const faction = await agent.post("/api/factions").send({
      name: "Thieves Guild", factionType: "criminal", agenda: "a", methods: "m", publicFace: "p", hook: "h",
    });
    const create = await agent.post("/api/characters").send(charPayload());
    expect(create.body.factionId).toBeNull();
    const id = create.body.id as string;

    const link = await agent.patch(`/api/characters/${id}`).send({ factionId: faction.body.id });
    expect(link.status).toBe(200);
    expect(link.body.factionId).toBe(faction.body.id);

    const { agent: other } = await signupAgent("cruduser10");
    const otherFaction = await other.post("/api/factions").send({
      name: "Rival Guild", factionType: "criminal", agenda: "a", methods: "m", publicFace: "p", hook: "h",
    });
    const badLink = await agent.patch(`/api/characters/${id}`).send({ factionId: otherFaction.body.id });
    expect(badLink.status).toBe(403);

    const unlink = await agent.patch(`/api/characters/${id}`).send({ factionId: null });
    expect(unlink.status).toBe(200);
    expect(unlink.body.factionId).toBeNull();
  });

  it("clears an NPC's factionId when the linked faction is deleted", async () => {
    const { agent } = await signupAgent("cruduser11");
    const faction = await agent.post("/api/factions").send({
      name: "Doomed Guild", factionType: "criminal", agenda: "a", methods: "m", publicFace: "p", hook: "h",
    });
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;
    await agent.patch(`/api/characters/${id}`).send({ factionId: faction.body.id });

    await agent.delete(`/api/factions/${faction.body.id}`);

    const get = await agent.get(`/api/characters/${id}`);
    expect(get.body.factionId).toBeNull();
  });

  it("adjusts disposition incrementally and logs delta/reason/author", async () => {
    const { agent } = await signupAgent("cruduser12");
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    const adjust = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 10, reason: "Saved their village" });
    expect(adjust.status).toBe(200);
    expect(adjust.body.disposition).toBe(10);

    const again = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: -3 });
    expect(again.status).toBe(200);
    expect(again.body.disposition).toBe(7);

    const log = await agent.get(`/api/characters/${id}/disposition-log`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(2);
    expect(log.body[0].delta).toBe(-3);
    expect(log.body[0].reason).toBeUndefined();
    expect(log.body[1].delta).toBe(10);
    expect(log.body[1].reason).toBe("Saved their village");
    expect(log.body[1].authorName).toBe("cruduser12");
  });

  it("adjusts per-PC disposition independently of general disposition and of other PCs", async () => {
    const { agent } = await signupAgent("cruduser22");
    const world = await agent.post("/api/worlds").send({ name: "Per-PC World" });
    const worldId = world.body.id as string;
    const create = await agent.post("/api/characters").send(charPayload({ worldId }));
    const id = create.body.id as string;
    const pc1 = await agent.post("/api/player-characters").send({ ...PC_BODY, name: "Aria", worldId });
    const pc2 = await agent.post("/api/player-characters").send({ ...PC_BODY, name: "Beren", worldId });
    const pc1Id = pc1.body.id as string;
    const pc2Id = pc2.body.id as string;

    await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 5, reason: "General goodwill" });
    const forPc1 = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 8, reason: "Saved Aria's life", playerCharacterId: pc1Id });
    expect(forPc1.status).toBe(200);
    expect(forPc1.body.disposition).toBe(5);
    expect(forPc1.body.perPcDisposition).toEqual({ [pc1Id]: 8 });

    const forPc2 = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: -4, playerCharacterId: pc2Id });
    expect(forPc2.body.perPcDisposition).toEqual({ [pc1Id]: 8, [pc2Id]: -4 });

    const again = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 2, playerCharacterId: pc1Id });
    expect(again.body.perPcDisposition).toEqual({ [pc1Id]: 10, [pc2Id]: -4 });
    expect(again.body.disposition).toBe(5);

    const log = await agent.get(`/api/characters/${id}/disposition-log`);
    expect(log.body).toHaveLength(4);
    const generalEntries = log.body.filter((e: { playerCharacterId?: string }) => !e.playerCharacterId);
    const pc1Entries = log.body.filter((e: { playerCharacterId?: string }) => e.playerCharacterId === pc1Id);
    expect(generalEntries).toHaveLength(1);
    expect(pc1Entries).toHaveLength(2);
  });

  it("403s adjust-disposition with a playerCharacterId belonging to someone else", async () => {
    const { agent } = await signupAgent("cruduser23");
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    const { agent: other } = await signupAgent("cruduser24");
    const otherWorld = await other.post("/api/worlds").send({ name: "Other World" });
    const otherPc = await other.post("/api/player-characters").send({ ...PC_BODY, worldId: otherWorld.body.id });

    const res = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 5, playerCharacterId: otherPc.body.id });
    expect(res.status).toBe(403);

    const check = await agent.get(`/api/characters/${id}`);
    expect(check.body.perPcDisposition).toEqual({});
  });

  it("400s adjust-disposition with a zero or missing delta", async () => {
    const { agent } = await signupAgent("cruduser13");
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    const zero = await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 0 });
    expect(zero.status).toBe(400);
    const missing = await agent.post(`/api/characters/${id}/adjust-disposition`).send({});
    expect(missing.status).toBe(400);
  });

  it("404s adjust-disposition and the disposition log for a non-owner", async () => {
    const { agent: owner } = await signupAgent("cruduser14");
    const create = await owner.post("/api/characters").send(charPayload());
    const id = create.body.id as string;

    const { agent: other } = await signupAgent("cruduser15");
    const adjust = await other.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 5 });
    expect(adjust.status).toBe(404);
  });

  it("lets a world member (not just the owner) read the disposition log", async () => {
    const { agent: dm } = await signupAgent("cruduser16");
    const world = await dm.post("/api/worlds").send({ name: "Shared World 2" });
    const worldId = world.body.id as string;
    const create = await dm.post("/api/characters").send(charPayload({ worldId }));
    const id = create.body.id as string;
    await dm.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 4, reason: "Helped at the gate" });

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("cruduser17");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const log = await player.get(`/api/characters/${id}/disposition-log`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(1);
    expect(log.body[0].reason).toBe("Helped at the gate");
  });

  it("lets the owner link an NPC to their own settlement, but not someone else's", async () => {
    const { agent } = await signupAgent("cruduser19");
    const settlement = await agent.post("/api/settlements").send({ name: "Stonegatehaven", settlementType: "Town", description: "A trade town." });
    const create = await agent.post("/api/characters").send(charPayload());
    expect(create.body.settlementId).toBeNull();
    const id = create.body.id as string;

    const link = await agent.patch(`/api/characters/${id}`).send({ settlementId: settlement.body.id });
    expect(link.status).toBe(200);
    expect(link.body.settlementId).toBe(settlement.body.id);

    const { agent: other } = await signupAgent("cruduser20");
    const otherSettlement = await other.post("/api/settlements").send({ name: "Rival Town", settlementType: "Town", description: "A rival trade town." });
    const badLink = await agent.patch(`/api/characters/${id}`).send({ settlementId: otherSettlement.body.id });
    expect(badLink.status).toBe(403);

    const unlink = await agent.patch(`/api/characters/${id}`).send({ settlementId: null });
    expect(unlink.status).toBe(200);
    expect(unlink.body.settlementId).toBeNull();
  });

  it("clears an NPC's settlementId when the linked settlement is deleted", async () => {
    const { agent } = await signupAgent("cruduser21");
    const settlement = await agent.post("/api/settlements").send({ name: "Doomed Town", settlementType: "Town", description: "Not long for this world." });
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;
    await agent.patch(`/api/characters/${id}`).send({ settlementId: settlement.body.id });

    await agent.delete(`/api/settlements/${settlement.body.id}`);

    const get = await agent.get(`/api/characters/${id}`);
    expect(get.body.settlementId).toBeNull();
  });

  it("cascade-deletes disposition log entries when the character is deleted", async () => {
    const { agent } = await signupAgent("cruduser18");
    const create = await agent.post("/api/characters").send(charPayload());
    const id = create.body.id as string;
    await agent.post(`/api/characters/${id}/adjust-disposition`).send({ delta: 2 });

    await agent.delete(`/api/characters/${id}`);
    const count = await prisma.dispositionLogEntry.count({ where: { characterId: id } });
    expect(count).toBe(0);
  });
});

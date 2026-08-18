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
});

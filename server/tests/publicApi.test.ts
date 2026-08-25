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
    kind: "npc", name: "Public API NPC", alignment: "Neutral", templateId: "guard", templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", proficiencyBonus: 2, actions: [] },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
    ...overrides,
  };
}

describe("API key management", () => {
  it("creates a key, returns the raw key once, then never again on list", async () => {
    const { agent } = await signupAgent("apikeyowner1");
    const created = await agent.post("/api/api-keys").send({ label: "CLI tool" });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe("CLI tool");
    expect(typeof created.body.key).toBe("string");
    expect(created.body.key.startsWith("spark_")).toBe(true);
    expect(created.body.keyPrefix).toBe(created.body.key.slice(0, 8));

    const listed = await agent.get("/api/api-keys");
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);
    expect(listed.body[0].key).toBeUndefined();
    expect(listed.body[0].keyPrefix).toBe(created.body.keyPrefix);
  });

  it("400s a key created with no label", async () => {
    const { agent } = await signupAgent("apikeyowner2");
    const res = await agent.post("/api/api-keys").send({});
    expect(res.status).toBe(400);
  });

  it("revokes a key so it can no longer authenticate", async () => {
    const { agent } = await signupAgent("apikeyowner3");
    const created = await agent.post("/api/api-keys").send({ label: "Old key" });
    const rawKey = created.body.key as string;

    const workingCall = await request(app).get("/api/v1/public/characters").set("Authorization", `Bearer ${rawKey}`);
    expect(workingCall.status).toBe(200);

    const revoked = await agent.delete(`/api/api-keys/${created.body.id}`);
    expect(revoked.status).toBe(204);

    const afterRevoke = await request(app).get("/api/v1/public/characters").set("Authorization", `Bearer ${rawKey}`);
    expect(afterRevoke.status).toBe(401);
  });

  it("404s revoking a key that isn't the caller's own", async () => {
    const { agent: owner } = await signupAgent("apikeyowner4");
    const created = await owner.post("/api/api-keys").send({ label: "Someone else's" });

    const { agent: other } = await signupAgent("apikeyother4");
    const res = await other.delete(`/api/api-keys/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});

describe("Public API — GET /api/v1/public/*", () => {
  it("401s with no Authorization header or a malformed key", async () => {
    expect((await request(app).get("/api/v1/public/characters")).status).toBe(401);
    expect((await request(app).get("/api/v1/public/characters").set("Authorization", "Bearer not-a-real-key")).status).toBe(401);
  });

  it("returns only the key owner's own characters, never another account's", async () => {
    const { agent: owner } = await signupAgent("pubapiowner1");
    const created = await owner.post("/api/api-keys").send({ label: "Read key" });
    const rawKey = created.body.key as string;

    const world = await owner.post("/api/worlds").send({ name: "Public API World" });
    await owner.post("/api/characters").send(charPayload({ worldId: world.body.id, name: "Owned NPC" }));

    const { agent: other } = await signupAgent("pubapiother1");
    await other.post("/api/characters").send(charPayload({ name: "Someone Else's NPC" }));

    const res = await request(app).get("/api/v1/public/characters").set("Authorization", `Bearer ${rawKey}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Owned NPC");
  });

  it("fetches a single character by id, 404s for one owned by another account", async () => {
    const { agent: owner } = await signupAgent("pubapiowner2");
    const created = await owner.post("/api/api-keys").send({ label: "Read key" });
    const rawKey = created.body.key as string;
    const char = await owner.post("/api/characters").send(charPayload());

    const found = await request(app).get(`/api/v1/public/characters/${char.body.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(char.body.id);

    const { agent: other } = await signupAgent("pubapiother2");
    const otherChar = await other.post("/api/characters").send(charPayload({ name: "Not yours" }));
    const notFound = await request(app).get(`/api/v1/public/characters/${otherChar.body.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(notFound.status).toBe(404);
  });

  it("serves locations, factions, quests, and session notes scoped to the key owner", async () => {
    const { agent: owner } = await signupAgent("pubapiowner3");
    const created = await owner.post("/api/api-keys").send({ label: "Read key" });
    const rawKey = created.body.key as string;
    const auth = { Authorization: `Bearer ${rawKey}` };

    await owner.post("/api/locations").send({
      name: "Old Well", locationType: "landmark", category: "wilderness",
      description: "A quiet clearing.", notableFeature: "an old well", keeper: "nobody", rumor: "it's haunted",
    });
    await owner.post("/api/factions").send({
      name: "Iron Legion", factionType: "military", agenda: "conquest", methods: "force", publicFace: "soldiers", hook: "war",
    });
    await owner.post("/api/quests").send({
      title: "Recover the Amulet", questType: "retrieval", tier: "low", hook: "a rumor", objective: "find it", complication: "guarded", reward: "gold",
    });
    await owner.post("/api/session-notes").send({ title: "Session 1", summary: "The party arrived." });

    expect((await request(app).get("/api/v1/public/locations").set(auth)).body).toHaveLength(1);
    expect((await request(app).get("/api/v1/public/factions").set(auth)).body).toHaveLength(1);
    expect((await request(app).get("/api/v1/public/quests").set(auth)).body).toHaveLength(1);
    expect((await request(app).get("/api/v1/public/session-notes").set(auth)).body).toHaveLength(1);
  });

  it("requires worldId for campaign events and 403s a world the key owner doesn't own", async () => {
    const { agent: owner } = await signupAgent("pubapiowner4");
    const created = await owner.post("/api/api-keys").send({ label: "Read key" });
    const rawKey = created.body.key as string;
    const auth = { Authorization: `Bearer ${rawKey}` };

    const world = await owner.post("/api/worlds").send({ name: "Event World" });
    await owner.post("/api/campaign-events").send({ worldId: world.body.id, title: "The bridge collapsed", description: "Chaos ensued." });

    const missing = await request(app).get("/api/v1/public/campaign-events").set(auth);
    expect(missing.status).toBe(400);

    const found = await request(app).get(`/api/v1/public/campaign-events?worldId=${world.body.id}`).set(auth);
    expect(found.status).toBe(200);
    expect(found.body).toHaveLength(1);

    const { agent: other } = await signupAgent("pubapiother4");
    const otherWorld = await other.post("/api/worlds").send({ name: "Not Yours" });
    const forbidden = await request(app).get(`/api/v1/public/campaign-events?worldId=${otherWorld.body.id}`).set(auth);
    expect(forbidden.status).toBe(403);
  });
});

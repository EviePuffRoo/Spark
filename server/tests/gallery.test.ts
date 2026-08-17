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

async function createCharacter(agent: ReturnType<typeof request.agent>) {
  const res = await agent.post("/api/characters").send({
    kind: "npc",
    name: "Test NPC",
    alignment: "Neutral",
    templateId: "guard",
    templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", proficiencyBonus: 2, actions: [] },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe("publish + report + clone", () => {
  it("publishes an owned entity and lists it in the gallery", async () => {
    const { agent } = await signupAgent("publisher1");
    const charId = await createCharacter(agent);

    const publish = await agent.post("/api/public").send({ entityType: "character", entityId: charId, title: "My Guard" });
    expect(publish.status).toBe(201);

    const { agent: viewer } = await signupAgent("viewer1");
    const gallery = await viewer.get("/api/public");
    expect(gallery.status).toBe(200);
    expect(gallery.body.entries).toHaveLength(1);
    expect(gallery.body.entries[0].title).toBe("My Guard");
  });

  it("rejects publishing an entity you don't own", async () => {
    const { agent: owner } = await signupAgent("owner1");
    const charId = await createCharacter(owner);

    const { agent: other } = await signupAgent("notowner1");
    const res = await other.post("/api/public").send({ entityType: "character", entityId: charId, title: "Not mine" });
    expect(res.status).toBe(403);
  });

  it("blocks publishing once canPublish is false", async () => {
    const { agent, userId } = await signupAgent("suspended1");
    const charId = await createCharacter(agent);
    await prisma.user.update({ where: { id: userId }, data: { canPublish: false } });

    const res = await agent.post("/api/public").send({ entityType: "character", entityId: charId, title: "Blocked" });
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate report from the same user with a 409, not a crash", async () => {
    const { agent: owner } = await signupAgent("owner2");
    const charId = await createCharacter(owner);
    const publish = await owner.post("/api/public").send({ entityType: "character", entityId: charId, title: "Reportable" });
    const entryId = publish.body.id as string;

    const { agent: reporter } = await signupAgent("reporter1");
    const first = await reporter.post(`/api/public/${entryId}/report`).send({ reason: "spam" });
    expect(first.status).toBe(201);

    const second = await reporter.post(`/api/public/${entryId}/report`).send({ reason: "other" });
    expect(second.status).toBe(409);
  });

  it("clones a published entry as an independent copy", async () => {
    const { agent: owner } = await signupAgent("owner3");
    const charId = await createCharacter(owner);
    const publish = await owner.post("/api/public").send({ entityType: "character", entityId: charId, title: "Clone Me" });
    const entryId = publish.body.id as string;

    const { agent: cloner } = await signupAgent("cloner1");
    const clone = await cloner.post(`/api/public/${entryId}/clone`);
    expect(clone.status).toBe(201);
    expect(clone.body.id).not.toBe(charId);

    const cloned = await prisma.character.findUnique({ where: { id: clone.body.id } });
    expect(cloned?.name).toBe("Test NPC");
  });
});

describe("admin moderation", () => {
  async function adminAgent() {
    const { agent } = await signupAgent("admintestuser"); // matches vitest.config.ts's ADMIN_USERNAMES
    return agent;
  }

  it("403s the moderation queue for a non-admin", async () => {
    const { agent } = await signupAgent("regularmod1");
    const res = await agent.get("/api/admin/gallery/reports");
    expect(res.status).toBe(403);
  });

  it("lists reported entries in the admin queue, removes one, and it disappears from every public read path", async () => {
    const { agent: owner } = await signupAgent("owner4");
    const charId = await createCharacter(owner);
    const publish = await owner.post("/api/public").send({ entityType: "character", entityId: charId, title: "Bad Entry" });
    const entryId = publish.body.id as string;

    const { agent: reporter } = await signupAgent("reporter2");
    await reporter.post(`/api/public/${entryId}/report`).send({ reason: "offensive" });

    const admin = await adminAgent();
    const queue = await admin.get("/api/admin/gallery/reports");
    expect(queue.status).toBe(200);
    expect(queue.body.entries.map((e: { id: string }) => e.id)).toContain(entryId);

    const removeRes = await admin.post(`/api/admin/gallery/entries/${entryId}/remove`).send({ reason: "policy violation" });
    expect(removeRes.status).toBe(204);

    const listAfter = await reporter.get("/api/public");
    expect(listAfter.body.entries.find((e: { id: string }) => e.id === entryId)).toBeUndefined();

    const getAfter = await reporter.get(`/api/public/${entryId}`);
    expect(getAfter.status).toBe(404);

    const cloneAfter = await reporter.post(`/api/public/${entryId}/clone`);
    expect(cloneAfter.status).toBe(404);
  });

  it("dismisses a report without removing the entry", async () => {
    const { agent: owner } = await signupAgent("owner5");
    const charId = await createCharacter(owner);
    const publish = await owner.post("/api/public").send({ entityType: "character", entityId: charId, title: "Fine Entry" });
    const entryId = publish.body.id as string;

    const { agent: reporter } = await signupAgent("reporter3");
    const report = await reporter.post(`/api/public/${entryId}/report`).send({ reason: "spam" });

    const admin = await adminAgent();
    const queueBefore = await admin.get("/api/admin/gallery/reports");
    const reportId = queueBefore.body.entries[0].reports[0].id as string;

    const dismiss = await admin.post(`/api/admin/gallery/reports/${reportId}/dismiss`);
    expect(dismiss.status).toBe(204);

    const stillListed = await reporter.get("/api/public");
    expect(stillListed.body.entries.find((e: { id: string }) => e.id === entryId)).toBeDefined();
  });

  it("suspends and restores a user's publishing rights", async () => {
    const { agent: target, userId } = await signupAgent("target1");
    const charId = await createCharacter(target);

    const admin = await adminAgent();
    await admin.post(`/api/admin/gallery/users/${userId}/suspend-publishing`);

    const blocked = await target.post("/api/public").send({ entityType: "character", entityId: charId, title: "Nope" });
    expect(blocked.status).toBe(403);

    await admin.post(`/api/admin/gallery/users/${userId}/restore-publishing`);
    const allowed = await target.post("/api/public").send({ entityType: "character", entityId: charId, title: "Yes" });
    expect(allowed.status).toBe(201);
  });
});

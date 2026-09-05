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

// The import route accepts a JSON file the user supplies. Several entity
// columns are TEXT holding stringified JSON, and the serializers parse them
// on the way back out — so a bundle carrying a non-JSON string in one of
// those fields must not be written verbatim, or every later read of that
// row throws and takes the whole list endpoint down with it.
describe("importing a malformed backup bundle", () => {
  it("does not leave a character row that breaks the roster listing", async () => {
    const { agent } = await signupAgent("corruptdm1");

    const res = await agent.post("/api/backup/import").send({
      version: 1,
      worlds: [{ id: "w1", name: "Broken World", description: null, currentDay: 1, houseRules: "{}" }],
      characters: [{
        id: "c1",
        kind: "npc",
        name: "Corrupted Soul",
        race: "Human",
        background: "Sailor",
        alignment: "Neutral",
        templateId: "commoner",
        templateName: "Commoner",
        statBlock: "this is not json",
        backstory: "neither is this",
        tags: "nope",
        notes: null,
        equippedItems: "[[[",
        attunedItems: "{{{",
        disposition: 0,
        perPcDisposition: "!!!",
        status: "alive",
        factionId: null,
        settlementId: null,
        worldId: "w1",
        hiddenFromParty: false,
      }],
    });

    // Either the import rejects the bad row, or it stores something safe —
    // both are fine. What must not happen is a 500 on the way back out.
    expect([200, 201, 400]).toContain(res.status);

    const list = await agent.get("/api/characters");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
  });

  it("does not leave an item row that breaks the item listing", async () => {
    const { agent } = await signupAgent("corruptdm2");

    await agent.post("/api/backup/import").send({
      version: 1,
      worlds: [{ id: "w1", name: "Broken World", description: null, currentDay: 1, houseRules: "{}" }],
      items: [{
        id: "i1",
        name: "Broken Blade",
        itemType: "weapon",
        category: "weapon",
        rarity: "common",
        description: "d",
        property: "p",
        history: "h",
        tags: "definitely not json",
        notes: null,
        worldId: "w1",
        hiddenFromParty: false,
      }],
    });

    const list = await agent.get("/api/items");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
  });
});

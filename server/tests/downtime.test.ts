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

const ITEM_BODY = {
  name: "Wand of Magic Missiles", itemType: "Wand", category: "Wondrous Item", rarity: "Uncommon",
  description: "Fires magic missiles.", property: "7 charges.", history: "Made by a hedge wizard.",
  value: 100,
};

function activityPayload(worldId: string, overrides: Record<string, unknown> = {}) {
  return {
    worldId, characterName: "Aria", activityType: "crafting", description: "Working the wand", daysSpent: 4,
    ...overrides,
  };
}

describe("downtime crafting", () => {
  it("logs a crafting activity with no craftedItemId exactly as before (no ledger side effects)", async () => {
    const { agent } = await signupAgent("downtimedm1");
    const world = await agent.post("/api/worlds").send({ name: "Downtime World" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(activityPayload(worldId));
    expect(res.status).toBe(201);
    expect(res.body.craftedItemId).toBeUndefined();

    const summary = await agent.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.body.gold).toBe(0);
    expect(summary.body.items).toHaveLength(0);
  });

  it("debits the crafting cost in gold and credits the item when craftedItemId is set", async () => {
    const { agent } = await signupAgent("downtimedm2");
    const world = await agent.post("/api/worlds").send({ name: "Downtime World 2" });
    const worldId = world.body.id as string;
    const item = await agent.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;

    const res = await agent.post("/api/downtime").send(activityPayload(worldId, { craftedItemId: itemId }));
    expect(res.status).toBe(201);
    expect(res.body.craftedItemId).toBe(itemId);

    const summary = await agent.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.status).toBe(200);
    expect(summary.body.gold).toBe(-50); // half of 100 value
    expect(summary.body.items).toHaveLength(1);
    expect(summary.body.items[0]).toMatchObject({ label: "Wand of Magic Missiles", quantity: 1, itemId });
  });

  it("403s when craftedItemId points at an item the caller can't access", async () => {
    const { agent: owner } = await signupAgent("downtimedm3");
    const item = await owner.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;

    const { agent: other } = await signupAgent("downtimedm4");
    const world = await other.post("/api/worlds").send({ name: "Other World" });
    const worldId = world.body.id as string;

    const res = await other.post("/api/downtime").send(activityPayload(worldId, { craftedItemId: itemId }));
    expect(res.status).toBe(403);

    const activities = await other.get(`/api/downtime?worldId=${worldId}`);
    expect(activities.body).toHaveLength(0);
  });

  it("400s a non-string craftedItemId", async () => {
    const { agent } = await signupAgent("downtimedm5");
    const world = await agent.post("/api/worlds").send({ name: "Downtime World 5" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(activityPayload(worldId, { craftedItemId: 12345 }));
    expect(res.status).toBe(400);
  });
});

const PC_BODY = {
  name: "Aria", className: "Fighter", level: 3, race: "Human", armorClass: 16, maxHp: 30,
  abilityScores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
};

describe("downtime rolled outcomes", () => {
  it("400s when outcomeId doesn't belong to the given activityType", async () => {
    const { agent } = await signupAgent("downtimeout1");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "training", description: "Sparring", outcomeId: "recovery-1" }),
    );
    expect(res.status).toBe(400);
  });

  it("400s outcomeId for an activityType with no outcome table (e.g. custom)", async () => {
    const { agent } = await signupAgent("downtimeout2");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World 2" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "custom", description: "Something else", outcomeId: "training-1" }),
    );
    expect(res.status).toBe(400);
  });

  it("applies a gold-effect outcome to the party ledger", async () => {
    const { agent } = await signupAgent("downtimeout3");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World 3" });
    const worldId = world.body.id as string;

    // carousing-1 is a fixed +25 gold outcome in the shared data table.
    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "carousing", description: "A night out", outcomeId: "carousing-1" }),
    );
    expect(res.status).toBe(201);

    const summary = await agent.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.body.gold).toBe(25);
  });

  it("restores HP on the caller's own player character for a recovery outcome", async () => {
    const { agent } = await signupAgent("downtimeout4");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World 4" });
    const worldId = world.body.id as string;
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId });
    const pcId = pc.body.id as string;
    await agent.patch(`/api/player-characters/${pcId}`).send({ currentHp: 10 }); // 20 missing out of 30 max

    // recovery-1 is a fixed 0.5 hpRestorePercent outcome, so ceil(20 * 0.5) = 10 healed.
    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "recovery", description: "Resting up", outcomeId: "recovery-1", playerCharacterId: pcId }),
    );
    expect(res.status).toBe(201);

    const updated = await agent.get(`/api/player-characters/${pcId}`);
    expect(updated.body.currentHp).toBe(20);
  });

  it("still logs a recovery outcome with no HP effect when no playerCharacterId is given", async () => {
    const { agent } = await signupAgent("downtimeout5");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World 5" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "recovery", description: "Resting up", outcomeId: "recovery-1" }),
    );
    expect(res.status).toBe(201);
  });

  it("403s when the recovery playerCharacterId belongs to someone else", async () => {
    const { agent: owner } = await signupAgent("downtimeout6");
    const world = await owner.post("/api/worlds").send({ name: "Outcome World 6" });
    const worldId = world.body.id as string;
    const pc = await owner.post("/api/player-characters").send({ ...PC_BODY, worldId });
    const pcId = pc.body.id as string;

    const { agent: other } = await signupAgent("downtimeout7");
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);
    await other.post("/api/worlds/join").send({ code: joinCode.body.code });

    const res = await other.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "recovery", description: "Resting up", outcomeId: "recovery-1", playerCharacterId: pcId }),
    );
    expect(res.status).toBe(403);
  });

  it("400s an invalid outcomeId for a supported activityType", async () => {
    const { agent } = await signupAgent("downtimeout8");
    const world = await agent.post("/api/worlds").send({ name: "Outcome World 8" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/downtime").send(
      activityPayload(worldId, { activityType: "training", description: "Sparring", outcomeId: "not-a-real-id" }),
    );
    expect(res.status).toBe(400);
  });
});

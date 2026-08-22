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

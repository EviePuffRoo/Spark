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

function shopPayload(overrides: Record<string, unknown> = {}) {
  return { name: "The Rusty Kettle", stock: [], ...overrides };
}

describe("shop settlement linking", () => {
  it("creates a shop with a settlement the caller owns and returns its id", async () => {
    const { agent } = await signupAgent("shopdm1");
    const settlement = await agent.post("/api/settlements").send({ name: "Stonegatehaven", settlementType: "Town", description: "A trade town." });

    const create = await agent.post("/api/shops").send(shopPayload({ settlementId: settlement.body.id }));
    expect(create.status).toBe(201);
    expect(create.body.settlementId).toBe(settlement.body.id);
  });

  it("403s creating a shop with a settlement the caller doesn't own", async () => {
    const { agent: owner } = await signupAgent("shopdm2");
    const settlement = await owner.post("/api/settlements").send({ name: "Someone Else's Town", settlementType: "Town", description: "Not yours." });

    const { agent: other } = await signupAgent("shopdm3");
    const create = await other.post("/api/shops").send(shopPayload({ settlementId: settlement.body.id }));
    expect(create.status).toBe(403);
  });

  it("lets the owner link, relink, and unlink a shop's settlement via patch", async () => {
    const { agent } = await signupAgent("shopdm4");
    const settlement = await agent.post("/api/settlements").send({ name: "Millbrookford", settlementType: "Village", description: "A quiet village." });
    const create = await agent.post("/api/shops").send(shopPayload());
    expect(create.body.settlementId).toBeNull();
    const id = create.body.id as string;

    const link = await agent.patch(`/api/shops/${id}`).send({ settlementId: settlement.body.id });
    expect(link.status).toBe(200);
    expect(link.body.settlementId).toBe(settlement.body.id);

    const { agent: other } = await signupAgent("shopdm5");
    const otherSettlement = await other.post("/api/settlements").send({ name: "Rival Town", settlementType: "Town", description: "A rival trade town." });
    const badLink = await agent.patch(`/api/shops/${id}`).send({ settlementId: otherSettlement.body.id });
    expect(badLink.status).toBe(403);

    const unlink = await agent.patch(`/api/shops/${id}`).send({ settlementId: null });
    expect(unlink.status).toBe(200);
    expect(unlink.body.settlementId).toBeNull();
  });

  it("clears a shop's settlementId when the linked settlement is deleted", async () => {
    const { agent } = await signupAgent("shopdm6");
    const settlement = await agent.post("/api/settlements").send({ name: "Doomed Town", settlementType: "Town", description: "Not long for this world." });
    const create = await agent.post("/api/shops").send(shopPayload({ settlementId: settlement.body.id }));
    const id = create.body.id as string;

    await agent.delete(`/api/settlements/${settlement.body.id}`);

    const get = await agent.get(`/api/shops/${id}`);
    expect(get.body.settlementId).toBeNull();
  });
});

describe("shop stock validation", () => {
  it("keeps -1 as the unlimited-stock sentinel but drops any other negative quantity", async () => {
    const { agent } = await signupAgent("shopdm7");
    const stock = [
      { id: "s1", itemId: "i1", itemName: "Rope, 50 ft", price: 1, quantity: -1 },
      { id: "s2", itemId: "i2", itemName: "Cursed Amulet", price: 1, quantity: -5 },
    ];
    const create = await agent.post("/api/shops").send(shopPayload({ stock }));
    expect(create.status).toBe(201);
    expect(create.body.stock).toEqual([{ id: "s1", itemId: "i1", itemName: "Rope, 50 ft", price: 1, quantity: -1 }]);
  });
});

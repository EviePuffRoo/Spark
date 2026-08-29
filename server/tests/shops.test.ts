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

describe("POST /shops/:id/purchase", () => {
  async function setupShopInWorld(quantity: number) {
    const { agent: dm } = await signupAgent("shopbuyer1");
    const world = await dm.post("/api/worlds").send({ name: "Shop World" });
    const worldId = world.body.id as string;
    await dm.post("/api/ledger").send({ worldId, kind: "gold", amount: 100, label: "Starting funds", authorName: "DM" });

    const stock = [{ id: "s1", itemId: "i1", itemName: "Rope, 50 ft", price: 10, quantity }];
    const shop = await dm.post("/api/shops").send(shopPayload({ worldId, stock }));
    return { dm, worldId, shopId: shop.body.id as string };
  }

  it("decrements stock and writes a paired gold-debit + item-credit ledger entry", async () => {
    const { dm, worldId, shopId } = await setupShopInWorld(5);

    const purchase = await dm.post(`/api/shops/${shopId}/purchase`).send({ itemId: "i1", quantity: 2, buyerName: "Aria" });
    expect(purchase.status).toBe(201);
    expect(purchase.body.shop.stock[0].quantity).toBe(3);
    expect(purchase.body.goldEntry.amount).toBe(-20);
    expect(purchase.body.itemEntry.amount).toBe(2);

    const summary = await dm.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.body.gold).toBe(80);
    const itemTotal = (summary.body.items as { itemId?: string; quantity: number }[]).find((i) => i.itemId === "i1");
    expect(itemTotal?.quantity).toBe(2);
  });

  it("never decrements unlimited (-1) stock", async () => {
    const { dm, shopId } = await setupShopInWorld(-1);

    const purchase = await dm.post(`/api/shops/${shopId}/purchase`).send({ itemId: "i1", quantity: 3, buyerName: "Aria" });
    expect(purchase.status).toBe(201);
    expect(purchase.body.shop.stock[0].quantity).toBe(-1);
  });

  it("400s a purchase that exceeds available stock", async () => {
    const { dm, shopId } = await setupShopInWorld(1);

    const purchase = await dm.post(`/api/shops/${shopId}/purchase`).send({ itemId: "i1", quantity: 2, buyerName: "Aria" });
    expect(purchase.status).toBe(400);
  });

  it("400s a purchase that costs more gold than the party ledger holds", async () => {
    const { dm, shopId } = await setupShopInWorld(50);

    const purchase = await dm.post(`/api/shops/${shopId}/purchase`).send({ itemId: "i1", quantity: 20, buyerName: "Aria" });
    expect(purchase.status).toBe(400);
  });

  it("404s a purchase for an itemId not stocked at this shop", async () => {
    const { dm, shopId } = await setupShopInWorld(5);

    const purchase = await dm.post(`/api/shops/${shopId}/purchase`).send({ itemId: "not-stocked", quantity: 1, buyerName: "Aria" });
    expect(purchase.status).toBe(404);
  });

  it("403s a purchase from a shop in a world the caller can't access", async () => {
    const { shopId } = await setupShopInWorld(5);
    const { agent: stranger } = await signupAgent("shopbuyer2");

    const purchase = await stranger.post(`/api/shops/${shopId}/purchase`).send({ itemId: "i1", quantity: 1, buyerName: "Stranger" });
    expect(purchase.status).toBe(403);
  });
});

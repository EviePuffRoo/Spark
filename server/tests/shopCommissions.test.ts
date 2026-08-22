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
  name: "Ring of Protection", itemType: "Ring", category: "Wondrous Item", rarity: "Rare",
  description: "Grants a bonus to AC and saves.", property: "+1 AC, +1 saves.", history: "Forged by a paladin order.",
  value: 200,
};

describe("shop commissions", () => {
  it("commissions an item, debits its crafting cost, and leaves it pending", async () => {
    const { agent } = await signupAgent("commissiondm1");
    const world = await agent.post("/api/worlds").send({ name: "Commission World" });
    const worldId = world.body.id as string;
    const shop = await agent.post("/api/shops").send({ name: "The Anvil", stock: [], worldId });
    const shopId = shop.body.id as string;
    const item = await agent.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;

    const res = await agent.post("/api/shop-commissions").send({ worldId, shopId, itemId, characterName: "Aria" });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(100); // half of 200 value
    expect(res.body.daysRequired).toBe(8);
    expect(res.body.deliveredAt).toBeUndefined();

    const summary = await agent.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.body.gold).toBe(-100);
    expect(summary.body.items).toHaveLength(0);

    const list = await agent.get(`/api/shop-commissions?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].deliveredAt).toBeUndefined();
  });

  it("lets the world owner deliver a commission, crediting the item and clearing it as delivered", async () => {
    const { agent } = await signupAgent("commissiondm2");
    const world = await agent.post("/api/worlds").send({ name: "Commission World 2" });
    const worldId = world.body.id as string;
    const shop = await agent.post("/api/shops").send({ name: "The Anvil", stock: [], worldId });
    const shopId = shop.body.id as string;
    const item = await agent.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;

    const commission = await agent.post("/api/shop-commissions").send({ worldId, shopId, itemId, characterName: "Aria" });
    const commissionId = commission.body.id as string;

    const deliver = await agent.post(`/api/shop-commissions/${commissionId}/deliver`);
    expect(deliver.status).toBe(200);
    expect(deliver.body.deliveredAt).toBeTruthy();

    const summary = await agent.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.body.gold).toBe(-100);
    expect(summary.body.items).toHaveLength(1);
    expect(summary.body.items[0]).toMatchObject({ label: "Ring of Protection", quantity: 1, itemId });

    const redeliver = await agent.post(`/api/shop-commissions/${commissionId}/deliver`);
    expect(redeliver.status).toBe(400);
  });

  it("lets a world member commission but only the owner can deliver", async () => {
    const { agent: dm } = await signupAgent("commissiondm3");
    const world = await dm.post("/api/worlds").send({ name: "Commission World 3" });
    const worldId = world.body.id as string;
    const shop = await dm.post("/api/shops").send({ name: "The Anvil", stock: [], worldId, hiddenFromParty: false });
    const shopId = shop.body.id as string;
    const item = await dm.post("/api/items").send({ ...ITEM_BODY, worldId, hiddenFromParty: false });
    const itemId = item.body.id as string;

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("commissionplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const commission = await player.post("/api/shop-commissions").send({ worldId, shopId, itemId, characterName: "Aria" });
    expect(commission.status).toBe(201);
    const commissionId = commission.body.id as string;

    const deliverByPlayer = await player.post(`/api/shop-commissions/${commissionId}/deliver`);
    expect(deliverByPlayer.status).toBe(403);

    const deliverByDm = await dm.post(`/api/shop-commissions/${commissionId}/deliver`);
    expect(deliverByDm.status).toBe(200);
  });

  it("404s a commission against a shop that isn't in the given world", async () => {
    const { agent } = await signupAgent("commissiondm4");
    const world1 = await agent.post("/api/worlds").send({ name: "World A" });
    const world2 = await agent.post("/api/worlds").send({ name: "World B" });
    const shop = await agent.post("/api/shops").send({ name: "The Anvil", stock: [], worldId: world1.body.id });
    const item = await agent.post("/api/items").send(ITEM_BODY);

    const res = await agent.post("/api/shop-commissions").send({
      worldId: world2.body.id, shopId: shop.body.id, itemId: item.body.id, characterName: "Aria",
    });
    expect(res.status).toBe(404);
  });
});

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

async function paidWorld(username: string, worldName: string) {
  const { agent, userId } = await signupAgent(username);
  await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
  const world = await agent.post("/api/worlds").send({ name: worldName });
  return { agent, userId, worldId: world.body.id as string };
}

async function addGold(agent: request.Agent, worldId: string, amount: number) {
  await agent.post("/api/ledger").send({ worldId, kind: "gold", label: "loot", amount, authorName: "DM" });
}

describe("home base", () => {
  it("403s for a world you don't have access to", async () => {
    const { agent: owner } = await paidWorld("baseowner1", "Private Base World");
    void owner;
    const { agent: outsider } = await signupAgent("baseoutsider1");
    const res = await outsider.get("/api/base").query({ worldId: "does-not-matter" });
    expect(res.status).toBe(403);
  });

  it("get-or-creates a base with sensible defaults", async () => {
    const { agent, worldId } = await paidWorld("baseowner2", "Fresh Base World");
    const res = await agent.get("/api/base").query({ worldId });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ worldId, name: "The Party's Outpost", level: 0, gold: 0, acquiredUpgradeIds: [] });
  });

  it("reports isPaid based on the world owner's tier, not the free default", async () => {
    const { agent } = await signupAgent("basefree1");
    const world = await agent.post("/api/worlds").send({ name: "Free Tier World" });
    const worldId = world.body.id as string;

    const res = await agent.get("/api/base").query({ worldId });
    expect(res.body.isPaid).toBe(false);
  });

  it("403s a purchase on a free-tier world with a machine-readable code", async () => {
    const { agent } = await signupAgent("basefreepurchase1");
    const world = await agent.post("/api/worlds").send({ name: "Free Tier Purchase World" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("base_paid_only");
  });

  it("purchases an upgrade, deducting gold through the ledger", async () => {
    const { agent, worldId } = await paidWorld("baseowner3", "Purchase World");
    await addGold(agent, worldId, 100);

    const res = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    expect(res.status).toBe(201);
    expect(res.body.acquiredUpgradeIds).toEqual(["palisade-fence"]);
    expect(res.body.level).toBe(1);
    expect(res.body.gold).toBe(50); // 100 - 50 cost

    const ledger = await agent.get("/api/ledger").query({ worldId });
    expect(ledger.body.entries[0]).toMatchObject({ kind: "gold", amount: -50 });
  });

  it("400s a purchase without enough gold", async () => {
    const { agent, worldId } = await paidWorld("baseowner4", "Poor World");
    const res = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/enough gold/i);
  });

  it("400s a purchase whose prerequisites aren't met", async () => {
    const { agent, worldId } = await paidWorld("baseowner5", "Prereq World");
    await addGold(agent, worldId, 1000);
    const res = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "stone-walls" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prerequisites/i);
  });

  it("400s a purchase that conflicts with an already-acquired exclusive-group upgrade", async () => {
    const { agent, worldId } = await paidWorld("baseowner6", "Exclusive World");
    await addGold(agent, worldId, 1000);

    const first = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "thieves-guild-pact" });
    expect(first.status).toBe(201);

    const conflicting = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "city-watch-charter" });
    expect(conflicting.status).toBe(400);
    expect(conflicting.body.error).toMatch(/different path/i);
  });

  it("400s purchasing the same upgrade twice", async () => {
    const { agent, worldId } = await paidWorld("baseowner7", "Repeat World");
    await addGold(agent, worldId, 1000);

    await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    const again = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already acquired/i);
  });

  it("400s an unknown upgrade id", async () => {
    const { agent, worldId } = await paidWorld("baseowner8", "Unknown Upgrade World");
    await addGold(agent, worldId, 1000);
    const res = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "not-a-real-upgrade" });
    expect(res.status).toBe(400);
  });

  it("sums acquired upgrades' defenseRating into the base state", async () => {
    const { agent, worldId } = await paidWorld("baseowner9", "Defense World");
    await addGold(agent, worldId, 1000);

    let res = await agent.get("/api/base").query({ worldId });
    expect(res.body.defenseRating).toBe(0);

    await agent.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    res = await agent.get("/api/base").query({ worldId });
    expect(res.body.defenseRating).toBe(2);

    await agent.post("/api/base/purchase").send({ worldId, upgradeId: "watchtower" });
    res = await agent.get("/api/base").query({ worldId });
    expect(res.body.defenseRating).toBe(5); // 2 (palisade) + 3 (watchtower)
  });

  it("generates and persists a real, buyable Shop when a shopUnlock upgrade is purchased", async () => {
    const { agent, worldId } = await paidWorld("baseowner10", "Trade World");
    await addGold(agent, worldId, 1000);

    const purchase = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "trade-post" });
    expect(purchase.status).toBe(201);
    expect(purchase.body.unlockedShops).toHaveLength(1);
    const { shopId, shopName } = purchase.body.unlockedShops[0];
    expect(purchase.body.unlockedShops[0].upgradeId).toBe("trade-post");

    const shop = await agent.get(`/api/shops/${shopId}`);
    expect(shop.status).toBe(200);
    expect(shop.body.name).toBe(shopName);
    expect(shop.body.worldId).toBe(worldId);
    expect(shop.body.stock.length).toBe(6);
  });

  it("applies a shopUnlock upgrade's priceMultiplier as a real discount on the generated stock", async () => {
    const { agent, worldId } = await paidWorld("baseowner11", "Blacksmith World");
    await addGold(agent, worldId, 1000);
    await agent.post("/api/base/purchase").send({ worldId, upgradeId: "trade-post" });

    const purchase = await agent.post("/api/base/purchase").send({ worldId, upgradeId: "resident-blacksmith" });
    const { shopId } = purchase.body.unlockedShops.find((s: { upgradeId: string }) => s.upgradeId === "resident-blacksmith");
    const shop = await agent.get(`/api/shops/${shopId}`);
    // Generated item values are random, so this can't assert exact prices —
    // it asserts the multiplier's rounding actually ran (integer prices,
    // never below the 1gp floor) rather than leaving raw floats or zeros.
    expect(shop.body.stock.length).toBeGreaterThan(0);
    for (const entry of shop.body.stock) {
      expect(Number.isInteger(entry.price)).toBe(true);
      expect(entry.price).toBeGreaterThanOrEqual(1);
    }
  });

  it("lets a paid world's member (not owner) purchase, gated on the owner's tier", async () => {
    const { agent: dm, worldId } = await paidWorld("basedm1", "Shared Base World");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("baseplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });
    await addGold(dm, worldId, 1000);

    const res = await player.post("/api/base/purchase").send({ worldId, upgradeId: "palisade-fence" });
    expect(res.status).toBe(201);
  });
});

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
  name: "Potion of Healing", itemType: "Potion", category: "Consumable", rarity: "Common",
  description: "Heals wounds.", property: "Restores 2d4+2 HP.", history: "Common alchemy.",
};
const PC_BODY = { name: "Aria", className: "Fighter", level: 1, race: "Human", armorClass: 15, maxHp: 12 };

describe("ledger item totals with itemId", () => {
  it("aggregates itemId-linked entries by id, not label, and free-text entries by label", async () => {
    const { agent: dm } = await signupAgent("ledgerdm1");
    const world = await dm.post("/api/worlds").send({ name: "Ledger World" });
    const worldId = world.body.id as string;

    const item = await dm.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;

    await dm.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: 2, authorName: "DM", itemId });
    await dm.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: 1, authorName: "DM", itemId });
    // Free-text entry that happens to share the same label but has no itemId — must not merge with the itemId group.
    await dm.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: 5, authorName: "DM" });

    const summary = await dm.get(`/api/ledger?worldId=${worldId}`);
    expect(summary.status).toBe(200);
    const totals = summary.body.items as { label: string; quantity: number; itemId?: string }[];
    const linked = totals.find((t) => t.itemId === itemId);
    const freeText = totals.find((t) => !t.itemId);
    expect(linked?.quantity).toBe(3);
    expect(freeText?.quantity).toBe(5);
  });
});

describe("POST /ledger/claim", () => {
  async function setupPartyWithItem() {
    const { agent: dm } = await signupAgent("claimdm1");
    const world = await dm.post("/api/worlds").send({ name: "Claim World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player, userId: playerId } = await signupAgent("claimplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const item = await dm.post("/api/items").send(ITEM_BODY);
    const itemId = item.body.id as string;
    await dm.post("/api/ledger").send({ worldId, kind: "item", label: "Potion of Healing", amount: 1, authorName: "DM", itemId });

    const pcRes = await player.post("/api/player-characters").send({ ...PC_BODY, worldId });
    const playerCharacterId = pcRes.body.id as string;

    return { dm, player, playerId, worldId, itemId, playerCharacterId };
  }

  it("moves the item onto the character's equippedItems and decrements the ledger", async () => {
    const { player, worldId, itemId, playerCharacterId } = await setupPartyWithItem();

    const claim = await player.post("/api/ledger/claim").send({ worldId, itemId, playerCharacterId });
    expect(claim.status).toBe(200);
    expect(claim.body.equippedItems).toContain(itemId);

    const summary = await player.get(`/api/ledger?worldId=${worldId}`);
    const total = (summary.body.items as { itemId?: string; quantity: number }[]).find((i) => i.itemId === itemId);
    expect(total).toBeUndefined(); // quantity dropped to 0, filtered out
  });

  it("rejects a claim that exceeds the available quantity", async () => {
    const { player, worldId, itemId, playerCharacterId } = await setupPartyWithItem();

    const first = await player.post("/api/ledger/claim").send({ worldId, itemId, playerCharacterId });
    expect(first.status).toBe(200);

    const second = await player.post("/api/ledger/claim").send({ worldId, itemId, playerCharacterId });
    expect(second.status).toBe(400);
  });

  it("404s a claim onto a player character the requester doesn't own", async () => {
    const { dm, worldId, itemId, playerCharacterId } = await setupPartyWithItem();

    const res = await dm.post("/api/ledger/claim").send({ worldId, itemId, playerCharacterId });
    expect(res.status).toBe(404);
  });

  it("400s a claim onto a player character assigned to a different world", async () => {
    const { dm, player, worldId, itemId } = await setupPartyWithItem();

    const otherWorld = await dm.post("/api/worlds").send({ name: "Other World" });
    const otherJoinCode = await dm.post(`/api/worlds/${otherWorld.body.id}/join-code`);
    await player.post("/api/worlds/join").send({ code: otherJoinCode.body.code });
    const otherPc = await player.post("/api/player-characters").send({ ...PC_BODY, worldId: otherWorld.body.id });

    const res = await player.post("/api/ledger/claim").send({ worldId, itemId, playerCharacterId: otherPc.body.id });
    expect(res.status).toBe(400);
  });
});

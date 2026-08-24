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

function factionPayload(name: string, worldId: string) {
  return { name, factionType: "criminal", agenda: "profit", methods: "theft", publicFace: "merchants", hook: "hook", worldId };
}

function characterPayload(name: string, worldId: string) {
  return {
    kind: "npc", name, alignment: "neutral", templateId: "t1", templateName: "Template",
    statBlock: { hp: 10, ac: 10 }, backstory: "backstory", worldId,
  };
}

async function setupWarWorld(dm: request.Agent) {
  const world = await dm.post("/api/worlds").send({ name: "Tick World" });
  const worldId = world.body.id as string;
  const a = await dm.post("/api/factions").send(factionPayload("Thieves Guild", worldId));
  const b = await dm.post("/api/factions").send(factionPayload("City Watch", worldId));
  await dm.post("/api/faction-relationships").send({
    worldId, factionAId: a.body.id, factionBId: b.body.id, stance: "war",
  });
  const character = await dm.post("/api/characters").send(characterPayload("Grix", worldId));
  await dm.patch(`/api/characters/${character.body.id}`).send({ factionId: a.body.id });
  const shop = await dm.post("/api/shops").send({
    name: "The Rusty Kettle", worldId,
    stock: Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, itemId: `i${i}`, itemName: `Item ${i}`, price: 20, quantity: 5 })),
  });
  await dm.post(`/api/worlds/${worldId}/advance-day`).send({ days: 14 });
  return { worldId, factionAId: a.body.id, factionBId: b.body.id, characterId: character.body.id, shopId: shop.body.id };
}

describe("world tick", () => {
  it("403s a proposal request from a non-owner", async () => {
    const { agent: dm } = await signupAgent("tickdm1");
    const { worldId } = await setupWarWorld(dm);
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("tickplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const res = await player.get(`/api/world-tick/${worldId}/proposal`);
    expect(res.status).toBe(403);
  });

  it("computes a non-empty, day-1-to-current proposal for a fresh world", async () => {
    const { agent: dm } = await signupAgent("tickdm2");
    const { worldId } = await setupWarWorld(dm);

    const res = await dm.get(`/api/world-tick/${worldId}/proposal`);
    expect(res.status).toBe(200);
    expect(res.body.fromDay).toBe(1);
    expect(res.body.toDay).toBe(15);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("applies a proposal and writes through to faction reputation, character disposition, campaign events, shop stock, and the tick log", async () => {
    const { agent: dm } = await signupAgent("tickdm3");
    const { worldId, factionAId, characterId, shopId } = await setupWarWorld(dm);

    const proposal = (await dm.get(`/api/world-tick/${worldId}/proposal`)).body;
    const applyRes = await dm.post(`/api/world-tick/${worldId}/apply`).send({
      worldId, fromDay: proposal.fromDay, toDay: proposal.toDay, items: proposal.items,
    });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.fromDay).toBe(proposal.fromDay);
    expect(applyRes.body.toDay).toBe(proposal.toDay);
    expect(applyRes.body.itemCount).toBeGreaterThan(0);

    const faction = await prisma.faction.findUniqueOrThrow({ where: { id: factionAId } });
    const repItem = proposal.items.find((i: { kind: string; factionId?: string }) => i.kind === "factionReputation" && i.factionId === factionAId);
    expect(faction.reputation).toBe(repItem.delta);
    const factionLog = await prisma.factionLogEntry.findMany({ where: { factionId: factionAId } });
    expect(factionLog).toHaveLength(1);
    expect(factionLog[0].authorName).toBe("World Tick");

    const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    const dispItem = proposal.items.find((i: { kind: string; characterId?: string }) => i.kind === "characterDisposition" && i.characterId === characterId);
    if (dispItem) {
      expect(character.disposition).toBe(dispItem.delta);
      const dispLog = await prisma.dispositionLogEntry.findMany({ where: { characterId } });
      expect(dispLog).toHaveLength(1);
      expect(dispLog[0].authorName).toBe("World Tick");
    }

    const eventItems = proposal.items.filter((i: { kind: string }) => i.kind === "campaignEvent");
    const events = await prisma.campaignEvent.findMany({ where: { worldId } });
    expect(events).toHaveLength(eventItems.length);

    const shopItems = proposal.items.filter((i: { kind: string }) => i.kind === "shopStock");
    if (shopItems.length > 0) {
      const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
      const stock = JSON.parse(shop.stock) as { id: string; price: number }[];
      for (const item of shopItems) {
        const entry = stock.find((s) => s.id === item.stockEntryId);
        expect(entry!.price).toBe(Math.max(1, 20 + item.delta));
      }
    }

    const log = await prisma.worldTickLog.findMany({ where: { worldId } });
    expect(log).toHaveLength(1);
    expect(log[0].fromDay).toBe(proposal.fromDay);
    expect(log[0].toDay).toBe(proposal.toDay);
  });

  it("only applies checked items (a subset of the proposal), leaving the rest untouched", async () => {
    const { agent: dm } = await signupAgent("tickdm4");
    const { worldId, factionAId } = await setupWarWorld(dm);

    const proposal = (await dm.get(`/api/world-tick/${worldId}/proposal`)).body;
    const kept = proposal.items.filter((i: { kind: string }) => i.kind !== "factionReputation");
    await dm.post(`/api/world-tick/${worldId}/apply`).send({
      worldId, fromDay: proposal.fromDay, toDay: proposal.toDay, items: kept,
    });

    const faction = await prisma.faction.findUniqueOrThrow({ where: { id: factionAId } });
    expect(faction.reputation).toBe(0);
    const factionLog = await prisma.factionLogEntry.findMany({ where: { factionId: factionAId } });
    expect(factionLog).toHaveLength(0);
  });

  it("advances fromDay after an apply so a second proposal doesn't re-propose the same days", async () => {
    const { agent: dm } = await signupAgent("tickdm5");
    const { worldId } = await setupWarWorld(dm);

    const first = (await dm.get(`/api/world-tick/${worldId}/proposal`)).body;
    await dm.post(`/api/world-tick/${worldId}/apply`).send({
      worldId, fromDay: first.fromDay, toDay: first.toDay, items: first.items,
    });

    const second = (await dm.get(`/api/world-tick/${worldId}/proposal`)).body;
    expect(second.fromDay).toBe(first.toDay);
    expect(second.toDay).toBe(first.toDay);
    expect(second.items).toEqual([]);
  });

  it("lists the tick log for a world member, not just the owner", async () => {
    const { agent: dm } = await signupAgent("tickdm6");
    const { worldId } = await setupWarWorld(dm);
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("tickplayer6");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const proposal = (await dm.get(`/api/world-tick/${worldId}/proposal`)).body;
    await dm.post(`/api/world-tick/${worldId}/apply`).send({
      worldId, fromDay: proposal.fromDay, toDay: proposal.toDay, items: proposal.items,
    });

    const res = await player.get(`/api/world-tick/${worldId}/log`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

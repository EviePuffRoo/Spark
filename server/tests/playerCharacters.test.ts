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

const PC_BODY = { name: "Aria", className: "Fighter", level: 1, race: "Human", armorClass: 15, maxHp: 12 };

describe("player character ownership transfer", () => {
  it("lets the world owner hand a PC to a member of that world", async () => {
    const { agent: dm } = await signupAgent("dm1");
    const world = await dm.post("/api/worlds").send({ name: "Handoff World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player, userId: playerId } = await signupAgent("player1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const pc = await dm.post("/api/player-characters").send({ ...PC_BODY, worldId });
    expect(pc.body.userId).not.toBe(playerId);

    const reassign = await dm.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: playerId });
    expect(reassign.status).toBe(200);
    expect(reassign.body.userId).toBe(playerId);

    // The player can now edit their own sheet...
    const playerEdit = await player.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 5 });
    expect(playerEdit.status).toBe(200);
    // ...and the DM, no longer the owner, can't.
    const dmEdit = await dm.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 1 });
    expect(dmEdit.status).toBe(404);
  });

  it("lets the world owner reassign a PC back to themselves", async () => {
    const { agent: dm, userId: dmId } = await signupAgent("dm2");
    const world = await dm.post("/api/worlds").send({ name: "Reclaim World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player, userId: playerId } = await signupAgent("player2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const pc = await dm.post("/api/player-characters").send({ ...PC_BODY, worldId });
    await dm.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: playerId });

    const reclaim = await dm.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: dmId });
    expect(reclaim.status).toBe(200);
    expect(reclaim.body.userId).toBe(dmId);
  });

  it("403s a non-owner of the world trying to reassign", async () => {
    const { agent: dm } = await signupAgent("dm3");
    const world = await dm.post("/api/worlds").send({ name: "Locked World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player, userId: playerId } = await signupAgent("player3");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const pc = await dm.post("/api/player-characters").send({ ...PC_BODY, worldId });

    const res = await player.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: playerId });
    expect(res.status).toBe(403);
  });

  it("400s a target user who isn't a member of the world", async () => {
    const { agent: dm } = await signupAgent("dm4");
    const world = await dm.post("/api/worlds").send({ name: "Solo World" });
    const worldId = world.body.id as string;

    const { userId: outsiderId } = await signupAgent("outsider4");

    const pc = await dm.post("/api/player-characters").send({ ...PC_BODY, worldId });

    const res = await dm.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: outsiderId });
    expect(res.status).toBe(400);
  });

  it("404s a PC with no world assigned (nothing to own a claim against)", async () => {
    const { agent: dm } = await signupAgent("dm5");
    const pc = await dm.post("/api/player-characters").send(PC_BODY);
    expect(pc.body.worldId).toBeNull();

    const res = await dm.patch(`/api/player-characters/${pc.body.id}/owner`).send({ userId: "anyone" });
    expect(res.status).toBe(404);
  });
});

describe("rest and the home base's comfort bonus", () => {
  it("heals HP on a short rest by the base's summed restBonus", async () => {
    const { agent } = await signupAgent("restdm1");
    const world = await agent.post("/api/worlds").send({ name: "Rest World" });
    const worldId = world.body.id as string;
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId, maxHp: 20 });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 5 });

    const base = await prisma.base.create({ data: { worldId } });
    await prisma.baseUpgrade.create({ data: { baseId: base.id, upgradeId: "common-room" } }); // +2
    await prisma.baseUpgrade.create({ data: { baseId: base.id, upgradeId: "private-quarters" } }); // +3

    const res = await agent.post(`/api/player-characters/${pc.body.id}/rest`).send({ kind: "short" });
    expect(res.status).toBe(200);
    expect(res.body.currentHp).toBe(10); // 5 + 2 + 3
  });

  it("caps the short-rest heal at maxHp instead of overhealing", async () => {
    const { agent } = await signupAgent("restdm2");
    const world = await agent.post("/api/worlds").send({ name: "Capped Rest World" });
    const worldId = world.body.id as string;
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId, maxHp: 12 });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 11 });

    const base = await prisma.base.create({ data: { worldId } });
    await prisma.baseUpgrade.create({ data: { baseId: base.id, upgradeId: "common-room" } }); // +2

    const res = await agent.post(`/api/player-characters/${pc.body.id}/rest`).send({ kind: "short" });
    expect(res.body.currentHp).toBe(12);
  });

  it("heals nothing extra on a short rest when the world has no base yet", async () => {
    const { agent } = await signupAgent("restdm3");
    const world = await agent.post("/api/worlds").send({ name: "No Base Rest World" });
    const worldId = world.body.id as string;
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId, maxHp: 20 });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 5 });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/rest`).send({ kind: "short" });
    expect(res.body.currentHp).toBe(5);
  });

  it("still fully heals on a long rest regardless of the base's restBonus", async () => {
    const { agent } = await signupAgent("restdm4");
    const world = await agent.post("/api/worlds").send({ name: "Long Rest World" });
    const worldId = world.body.id as string;
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, worldId, maxHp: 20 });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 1 });

    const base = await prisma.base.create({ data: { worldId } });
    await prisma.baseUpgrade.create({ data: { baseId: base.id, upgradeId: "common-room" } });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/rest`).send({ kind: "long" });
    expect(res.body.currentHp).toBe(20);
  });
});

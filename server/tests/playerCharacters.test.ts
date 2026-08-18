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

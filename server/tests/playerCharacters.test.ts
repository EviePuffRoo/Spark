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
    // ...and the DM, though no longer the PC's owner, still can — the
    // world's owner always has write access to entities in their own
    // world (Organizations Phase B), independent of per-entity ownership.
    const dmEdit = await dm.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 1 });
    expect(dmEdit.status).toBe(200);
    expect(dmEdit.body.currentHp).toBe(1);
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

describe("level-up", () => {
  it("recomputes HP incrementally, refreshes spell slots, and bumps proficiency bonus for a recognized class", async () => {
    const { agent } = await signupAgent("leveldm1");
    const pc = await agent.post("/api/player-characters").send({
      name: "Vex", className: "Wizard", level: 1, race: "Human", armorClass: 12, maxHp: 6,
      abilityScores: { str: 8, dex: 14, con: 12, int: 15, wis: 10, cha: 10 },
    });
    expect(pc.body.proficiencyBonus).toBe(2);
    expect(pc.body.spellSlots).toEqual([]); // level 1 wizard: no slots snapshotted at creation by this route

    const res = await agent.post(`/api/player-characters/${pc.body.id}/level-up`).send({ toLevel: 2 });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
    // Wizard hit die 6, conMod +1: perLevelAverage = floor(6/2)+1+1 = 5.
    expect(res.body.maxHp).toBe(11);
    expect(res.body.currentHp).toBe(11);
    expect(res.body.proficiencyBonus).toBe(2);
    expect(res.body.spellSlots).toEqual([{ level: 1, max: 3, current: 3 }]);
  });

  it("adds the HP gain on top of current HP rather than resetting to full", async () => {
    const { agent } = await signupAgent("leveldm2");
    const pc = await agent.post("/api/player-characters").send({
      name: "Bram", className: "Fighter", level: 1, race: "Dwarf", armorClass: 16, maxHp: 12,
      abilityScores: { str: 15, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
    });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ currentHp: 3 });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/level-up`).send({ toLevel: 2 });
    // Fighter hit die 10, conMod +2: perLevelAverage = floor(10/2)+1+2 = 8.
    expect(res.body.maxHp).toBe(20);
    expect(res.body.currentHp).toBe(11); // 3 + 8, not reset to 20
  });

  it("infers the target level from xp when toLevel is omitted", async () => {
    const { agent } = await signupAgent("leveldm3");
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, maxHp: 12 });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ xp: 300 });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/level-up`).send({});
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
  });

  it("400s a target level that doesn't exceed the current level", async () => {
    const { agent } = await signupAgent("leveldm4");
    const pc = await agent.post("/api/player-characters").send({ ...PC_BODY, level: 3 });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/level-up`).send({ toLevel: 3 });
    expect(res.status).toBe(400);
  });

  it("404s a level-up attempt from a non-owner", async () => {
    const { agent: dm } = await signupAgent("leveldm5");
    const { agent: other } = await signupAgent("levelother5");
    const pc = await dm.post("/api/player-characters").send(PC_BODY);

    const res = await other.post(`/api/player-characters/${pc.body.id}/level-up`).send({ toLevel: 2 });
    expect(res.status).toBe(404);
  });

  it("falls back gracefully for an unrecognized class name, still updating HP/proficiency but leaving existing spell slots untouched", async () => {
    const { agent } = await signupAgent("leveldm6");
    const pc = await agent.post("/api/player-characters").send({
      name: "Zeth", className: "Homebrew Artificer", level: 4, race: "Gnome", armorClass: 14, maxHp: 30,
    });
    await agent.patch(`/api/player-characters/${pc.body.id}`).send({ spellSlots: [{ level: 1, max: 2, current: 1 }] });

    const res = await agent.post(`/api/player-characters/${pc.body.id}/level-up`).send({ toLevel: 5 });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(5);
    expect(res.body.proficiencyBonus).toBe(3);
    // d8 fallback, conMod 0: perLevelAverage = floor(8/2)+1+0 = 5.
    expect(res.body.maxHp).toBe(35);
    expect(res.body.spellSlots).toEqual([{ level: 1, max: 2, current: 1 }]); // untouched, not reset/wiped
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

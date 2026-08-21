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

describe("combat automation: attacks and condition durations", () => {
  it("round-trips a combatant's parsed attacks and coerces legacy string conditions", async () => {
    const { agent: dm } = await signupAgent("dm1");
    const world = await dm.post("/api/worlds").send({ name: "Attack Test World" });
    const worldId = world.body.id as string;

    const combatants = [
      {
        id: "goblin-1",
        name: "Goblin",
        kind: "monster",
        initiative: 12,
        maxHp: 7,
        currentHp: 7,
        armorClass: 15,
        conditions: ["Poisoned"], // legacy shape: plain strings
        notes: "",
        hpVisible: false,
        attacks: [
          { name: "Scimitar", toHitBonus: 4, damageDice: "1d6+2", damageType: "slashing", savingThrow: null },
        ],
      },
    ];

    const put = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    expect(put.body.combatants[0].conditions).toEqual([{ name: "Poisoned", expiresAtRound: null }]);
    expect(put.body.combatants[0].attacks).toEqual([
      { name: "Scimitar", toHitBonus: 4, damageDice: "1d6+2", damageType: "slashing", savingThrow: null },
    ]);

    const get = await dm.get(`/api/encounters/${worldId}`);
    expect(get.body.combatants[0].conditions).toEqual([{ name: "Poisoned", expiresAtRound: null }]);
    expect(get.body.combatants[0].attacks).toHaveLength(1);
  });

  it("hides attacks and drops expired conditions for a non-owner party member", async () => {
    const { agent: dm } = await signupAgent("dm2");
    const world = await dm.post("/api/worlds").send({ name: "Redaction World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("player2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const combatants = [
      {
        id: "goblin-1",
        name: "Goblin",
        kind: "monster",
        initiative: 12,
        maxHp: 7,
        currentHp: 7,
        armorClass: 15,
        hpVisible: true,
        conditions: [
          { name: "Stunned", expiresAtRound: 5 }, // still active at round 3
          { name: "Frightened", expiresAtRound: 2 }, // already lapsed by round 3
        ],
        notes: "",
        attacks: [{ name: "Scimitar", toHitBonus: 4, damageDice: "1d6+2", damageType: "slashing", savingThrow: null }],
      },
    ];
    await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 3, turnIndex: 0 });

    const ownerView = await dm.get(`/api/encounters/${worldId}`);
    expect(ownerView.body.combatants[0].attacks).toHaveLength(1);
    expect(ownerView.body.combatants[0].conditions.map((c: { name: string }) => c.name)).toEqual(["Stunned"]);

    const playerView = await player.get(`/api/encounters/${worldId}`);
    expect(playerView.body.combatants[0].attacks).toBeUndefined();
    expect(playerView.body.combatants[0].conditions.map((c: { name: string }) => c.name)).toEqual(["Stunned"]);
  });
});

describe("grid combat: battle map position and move-grid", () => {
  async function setupWorldWithMap(dmUsername: string) {
    const { agent: dm } = await signupAgent(dmUsername);
    const world = await dm.post("/api/worlds").send({ name: "Grid World" });
    const worldId = world.body.id as string;
    const map = await dm.post("/api/battle-maps").send({ name: "Test Room", width: 10, height: 10 });
    return { dm, worldId, mapId: map.body.id as string };
  }

  it("round-trips gridX/gridY/sizeCategory/speedFeet and activeBattleMapId", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("griddm1");
    const combatants = [
      { id: "c1", name: "Ogre", kind: "monster", initiative: 8, maxHp: 20, currentHp: 20, conditions: [], notes: "", hpVisible: false, gridX: 2, gridY: 3, sizeCategory: "large", speedFeet: 40 },
    ];
    const res = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0, activeBattleMapId: mapId });
    expect(res.status).toBe(200);
    expect(res.body.activeBattleMapId).toBe(mapId);
    expect(res.body.combatants[0]).toMatchObject({ gridX: 2, gridY: 3, sizeCategory: "large", speedFeet: 40 });
  });

  it("400s move-grid with no battle map loaded", async () => {
    const { dm, worldId } = await setupWorldWithMap("griddm2");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 0, gridY: 0 }],
      round: 1, turnIndex: 0,
    });
    const res = await dm.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 1, gridY: 1 });
    expect(res.status).toBe(400);
  });

  it("400s a move that would fall off the edge of the map, accounting for footprint size", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("griddm3");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Giant", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 0, gridY: 0, sizeCategory: "huge" }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    // width/height are 10; huge footprint is 3 tiles, so x=8 (8+3=11) is off the edge.
    const res = await dm.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 8, gridY: 0 });
    expect(res.status).toBe(400);
  });

  it("lets a non-owner party member move a token within its speed, and rejects moving further than its speed allows", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("griddm4");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("gridplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Fighter", kind: "playerCharacter", initiative: 8, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 5, speedFeet: 30 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    // 30ft speed = 6 tiles at 5ft/step; (7,5) is 2 tiles away — within reach.
    const nearMove = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 7, gridY: 5 });
    expect(nearMove.status).toBe(200);
    expect(nearMove.body.combatants[0]).toMatchObject({ gridX: 7, gridY: 5 });

    // From the new position (7,5), 7 tiles west (35ft) is past 30ft speed.
    const farMove = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 0, gridY: 5 });
    expect(farMove.status).toBe(400);
  });

  it("lets the owner move a token any distance via the full PUT, bypassing the speed check", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("griddm5");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 0, gridY: 0, speedFeet: 30 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    const res = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 9, gridY: 9, speedFeet: 30 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    expect(res.status).toBe(200);
    expect(res.body.combatants[0]).toMatchObject({ gridX: 9, gridY: 9 });
  });

  it("403s move-grid for a non-member", async () => {
    const { worldId } = await setupWorldWithMap("griddm6");
    const { agent: outsider } = await signupAgent("gridoutsider1");
    const res = await outsider.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 1, gridY: 1 });
    expect(res.status).toBe(403);
  });
});

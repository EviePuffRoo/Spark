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

  it("round-trips concentratingOn through PUT and preserves it across adjust-hp", async () => {
    const { agent: dm } = await signupAgent("concentration-dm");
    const world = await dm.post("/api/worlds").send({ name: "Concentration Test World" });
    const worldId = world.body.id as string;

    const combatants = [
      { id: "wizard-1", name: "Elowen", kind: "playerCharacter", initiative: 15, maxHp: 20, currentHp: 20, conditions: [], notes: "", hpVisible: true, concentratingOn: "Web" },
    ];
    const put = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    expect(put.body.combatants[0].concentratingOn).toBe("Web");

    const adjust = await dm.post(`/api/encounters/${worldId}/adjust-hp`).send({ combatantId: "wizard-1", delta: -8 });
    expect(adjust.status).toBe(200);
    expect(adjust.body.combatants[0].currentHp).toBe(12);
    expect(adjust.body.combatants[0].concentratingOn).toBe("Web");

    const get = await dm.get(`/api/encounters/${worldId}`);
    expect(get.body.combatants[0].concentratingOn).toBe("Web");
  });

  it("drops a blank or non-string concentratingOn rather than persisting it", async () => {
    const { agent: dm } = await signupAgent("concentration-dm2");
    const world = await dm.post("/api/worlds").send({ name: "Concentration Test World 2" });
    const worldId = world.body.id as string;

    const combatants = [
      { id: "fighter-1", name: "Bram", kind: "playerCharacter", initiative: 10, maxHp: 15, currentHp: 15, conditions: [], notes: "", hpVisible: true, concentratingOn: "" },
      { id: "fighter-2", name: "Torin", kind: "playerCharacter", initiative: 8, maxHp: 15, currentHp: 15, conditions: [], notes: "", hpVisible: true, concentratingOn: 42 },
    ];
    const put = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    expect(put.body.combatants[0].concentratingOn).toBeUndefined();
    expect(put.body.combatants[1].concentratingOn).toBeUndefined();
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

  it("round-trips legendary/lair action fields through PUT, and hides the descriptive lists (but not the pip counts) from a non-owner", async () => {
    const { agent: dm } = await signupAgent("legendary-dm");
    const world = await dm.post("/api/worlds").send({ name: "Legendary Test World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("legendary-player");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const combatants = [
      {
        id: "vampire-1",
        name: "Vampire",
        kind: "monster",
        initiative: 18,
        maxHp: 144,
        currentHp: 144,
        conditions: [],
        notes: "",
        hpVisible: true,
        legendaryActionsMax: 3,
        legendaryActionsRemaining: 2,
        legendaryActionsList: [
          { name: "Move", cost: 1, description: "Moves up to its speed without provoking opportunity attacks." },
          { name: "Bite", cost: 2, description: "Bites one creature within 5 ft." },
        ],
        lairActionsList: [{ name: "Grasping Fog", description: "Fog fills a 20-foot-radius sphere." }],
        lairActionUsedRound: 1,
      },
    ];
    const put = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    expect(put.body.combatants[0].legendaryActionsMax).toBe(3);
    expect(put.body.combatants[0].legendaryActionsRemaining).toBe(2);
    expect(put.body.combatants[0].legendaryActionsList).toHaveLength(2);
    expect(put.body.combatants[0].lairActionsList).toHaveLength(1);
    expect(put.body.combatants[0].lairActionUsedRound).toBe(1);

    const ownerView = await dm.get(`/api/encounters/${worldId}`);
    expect(ownerView.body.combatants[0].legendaryActionsList).toHaveLength(2);
    expect(ownerView.body.combatants[0].lairActionsList).toHaveLength(1);

    const playerView = await player.get(`/api/encounters/${worldId}`);
    expect(playerView.body.combatants[0].legendaryActionsMax).toBe(3);
    expect(playerView.body.combatants[0].legendaryActionsRemaining).toBe(2);
    expect(playerView.body.combatants[0].legendaryActionsList).toBeUndefined();
    expect(playerView.body.combatants[0].lairActionsList).toBeUndefined();
  });

  it("clamps visionRadiusFeet/lightRadiusFeet/legendaryActionsMax to a finite upper bound rather than persisting them unbounded", async () => {
    // An unbounded radius here would otherwise turn computeVisibleCells'
    // O(radius^2) loop into a multi-trillion-iteration hang on every read
    // of this encounter, and an unbounded legendaryActionsMax would crash
    // the client's `.repeat()` pip rendering — see clampFinite's comment
    // in encounters.ts.
    const { agent: dm } = await signupAgent("clamp-dm");
    const world = await dm.post("/api/worlds").send({ name: "Clamp Test World" });
    const worldId = world.body.id as string;

    const combatants = [
      {
        id: "c1", name: "Overloaded", kind: "monster", initiative: 10, conditions: [], notes: "", hpVisible: false,
        visionRadiusFeet: 5_000_000, lightRadiusFeet: 5_000_000, legendaryActionsMax: 1_000_000_000, legendaryActionsRemaining: -50,
      },
    ];
    const put = await dm.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    const c = put.body.combatants[0];
    expect(c.visionRadiusFeet).toBeLessThanOrEqual(1000);
    expect(c.lightRadiusFeet).toBeLessThanOrEqual(1000);
    expect(c.legendaryActionsMax).toBeLessThanOrEqual(20);
    expect(c.legendaryActionsRemaining).toBe(0);
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

  it("404s a non-owner trying to move-grid a hidden combatant, but lets the owner move it", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("griddm7");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("gridplayer2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "c1", name: "Ambusher", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 0, gridY: 0, hidden: true }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const playerMove = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 1, gridY: 0 });
    expect(playerMove.status).toBe(404);

    const dmMove = await dm.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "c1", gridX: 1, gridY: 0 });
    expect(dmMove.status).toBe(200);
  });
});

describe("grid combat: ephemeral drag-position broadcast", () => {
  it("400s with no combatantId/gridX/gridY", async () => {
    const { agent } = await signupAgent("broadcastdm1");
    const world = await agent.post("/api/worlds").send({ name: "Broadcast World" });
    const res = await agent.post(`/api/encounters/${world.body.id}/broadcast-token-position`).send({});
    expect(res.status).toBe(400);
  });

  it("403s for a non-member", async () => {
    const { agent: dm } = await signupAgent("broadcastdm2");
    const world = await dm.post("/api/worlds").send({ name: "Broadcast World 2" });
    const { agent: outsider } = await signupAgent("broadcastoutsider1");
    const res = await outsider.post(`/api/encounters/${world.body.id}/broadcast-token-position`).send({ combatantId: "c1", gridX: 1, gridY: 1 });
    expect(res.status).toBe(403);
  });

  it("204s with no active encounter yet (nothing to resolve hidden against)", async () => {
    const { agent } = await signupAgent("broadcastdm3");
    const world = await agent.post("/api/worlds").send({ name: "Broadcast World 3" });
    const res = await agent.post(`/api/encounters/${world.body.id}/broadcast-token-position`).send({ combatantId: "c1", gridX: 1, gridY: 1 });
    expect(res.status).toBe(204);
  });

  it("204s for both a normal and a hidden combatant, and never writes to the database", async () => {
    const { agent } = await signupAgent("broadcastdm4");
    const world = await agent.post("/api/worlds").send({ name: "Broadcast World 4" });
    const worldId = world.body.id as string;
    await agent.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "visible", name: "Fighter", kind: "playerCharacter", initiative: 8, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1 },
        { id: "secret", name: "Ambusher", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, hidden: true, gridX: 2, gridY: 2 },
      ],
      round: 1, turnIndex: 0,
    });

    const before = await prisma.encounter.findUnique({ where: { worldId } });

    const visibleRes = await agent.post(`/api/encounters/${worldId}/broadcast-token-position`).send({ combatantId: "visible", gridX: 5, gridY: 5 });
    expect(visibleRes.status).toBe(204);
    const hiddenRes = await agent.post(`/api/encounters/${worldId}/broadcast-token-position`).send({ combatantId: "secret", gridX: 6, gridY: 6 });
    expect(hiddenRes.status).toBe(204);

    const after = await prisma.encounter.findUnique({ where: { worldId } });
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
    expect(JSON.parse(after!.combatants).find((c: { id: string }) => c.id === "visible").gridX).toBe(1);
  });
});

describe("grid combat: dynamic vision and fog of war", () => {
  // Fog of war is a paid-tier feature (gated on the world owner's tier), so
  // every test below that exercises actual fog behavior needs a paid DM —
  // a free-tier DM's world never computes vision at all (see the dedicated
  // free-tier test at the end of this block).
  async function setupWorldWithMap(dmUsername: string) {
    const { agent: dm, userId } = await signupAgent(dmUsername);
    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
    const world = await dm.post("/api/worlds").send({ name: "Vision World" });
    const worldId = world.body.id as string;
    const map = await dm.post("/api/battle-maps").send({ name: "Vision Room", width: 10, height: 10 });
    return { dm, worldId, mapId: map.body.id as string };
  }

  it("hides a monster outside the party's current vision from a non-owner, but the owner still sees it", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm1");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("visionplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 10 },
        { id: "near", name: "Nearby Goblin", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 1, gridY: 2 },
        { id: "far", name: "Distant Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 8, gridY: 8 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const playerView = await player.get(`/api/encounters/${worldId}`);
    const playerNames = playerView.body.combatants.map((c: { name: string }) => c.name);
    expect(playerNames).toContain("Fighter");
    expect(playerNames).toContain("Nearby Goblin");
    expect(playerNames).not.toContain("Distant Ogre");

    const ownerView = await dm.get(`/api/encounters/${worldId}`);
    const ownerNames = ownerView.body.combatants.map((c: { name: string }) => c.name);
    expect(ownerNames).toContain("Distant Ogre");
  });

  it("accumulates exploredCells across writes on the same map and resets when the map changes", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm2");
    const map2 = await dm.post("/api/battle-maps").send({ name: "Second Room", width: 10, height: 10 });

    const first = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    expect(first.body.exploredCells.length).toBeGreaterThan(0);
    const firstExploredCount = first.body.exploredCells.length;

    // Move further on the same map — exploredCells should grow, not reset.
    const moved = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 6, gridY: 6, visionRadiusFeet: 5 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    expect(moved.body.exploredCells.length).toBeGreaterThan(firstExploredCount);

    // Switching to a different battle map starts fog fresh.
    const switched = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5 }],
      round: 1, turnIndex: 0, activeBattleMapId: map2.body.id,
    });
    expect(switched.body.exploredCells.length).toBe(firstExploredCount);
  });

  it("never fog-gates a playerCharacter token, only monsters/custom", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm3");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("visionplayer3");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5 },
        { id: "pc2", name: "Rogue", kind: "playerCharacter", initiative: 9, conditions: [], notes: "", hpVisible: true, gridX: 9, gridY: 9, visionRadiusFeet: 5 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const playerView = await player.get(`/api/encounters/${worldId}`);
    const names = playerView.body.combatants.map((c: { name: string }) => c.name);
    expect(names).toContain("Fighter");
    expect(names).toContain("Rogue");
  });

  it("persists a combatant's lightRadiusFeet and lets it reveal a monster beyond their vision radius to a non-owner", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm5");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("visionplayer5");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const put = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Torchbearer", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5, lightRadiusFeet: 25 },
        { id: "far", name: "Lit Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 5, gridY: 1 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    expect(put.status).toBe(200);
    expect(put.body.combatants.find((c: { id: string }) => c.id === "pc1").lightRadiusFeet).toBe(25);

    const playerView = await player.get(`/api/encounters/${worldId}`);
    const playerNames = playerView.body.combatants.map((c: { name: string }) => c.name);
    expect(playerNames).toContain("Lit Ogre");
  });

  it("does not reveal a monster from a combatant's light while that combatant's own cell is still unseen", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm6");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("visionplayer6");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 0, gridY: 0, visionRadiusFeet: 5 },
        { id: "torchNpc", name: "Torch NPC", kind: "monster", initiative: 5, conditions: [], notes: "", hpVisible: false, gridX: 9, gridY: 9, lightRadiusFeet: 25 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const playerView = await player.get(`/api/encounters/${worldId}`);
    const playerNames = playerView.body.combatants.map((c: { name: string }) => c.name);
    expect(playerNames).not.toContain("Torch NPC");
  });

  it("move-grid also grows exploredCells", async () => {
    const { dm, worldId, mapId } = await setupWorldWithMap("visiondm4");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    const before = await prisma.encounter.findUnique({ where: { worldId } });
    const beforeCount = JSON.parse(before!.exploredCells).length;

    const res = await dm.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "pc1", gridX: 7, gridY: 7 });
    expect(res.status).toBe(200);
    expect(res.body.exploredCells.length).toBeGreaterThan(beforeCount);
  });

  it("never fog-gates a free-tier DM's world — every monster stays visible to everyone", async () => {
    const { agent: dm } = await signupAgent("visionfreedm1");
    const world = await dm.post("/api/worlds").send({ name: "Free Tier Vision World" });
    const worldId = world.body.id as string;
    const map = await dm.post("/api/battle-maps").send({ name: "Free Room", width: 10, height: 10 });
    const mapId = map.body.id as string;

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("visionfreeplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1, visionRadiusFeet: 5 },
        { id: "far", name: "Distant Ogre", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 9, gridY: 9 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const playerView = await player.get(`/api/encounters/${worldId}`);
    expect(playerView.body.visibleCells).toBeUndefined();
    const playerNames = playerView.body.combatants.map((c: { name: string }) => c.name);
    expect(playerNames).toContain("Distant Ogre");
  });
});

describe("grid combat: doors", () => {
  async function setupWorldWithDoor(dmUsername: string) {
    const { agent: dm, userId } = await signupAgent(dmUsername);
    // The first test below relies on fog hiding a monster beyond a closed
    // door — a paid-tier feature — so this DM needs paid tier the same way
    // setupWorldWithMap above does.
    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
    const world = await dm.post("/api/worlds").send({ name: "Door World" });
    const worldId = world.body.id as string;
    // A wall spans the whole row at y=1 except for the door at x=5, so a
    // closed door is the only way through — same "wall off the detour"
    // trick the difficult-terrain test above uses, otherwise an
    // 8-directional flood fill can just route around a single blocked tile.
    const tiles = Array.from({ length: 10 }, (_, x) => (x === 5 ? { x, y: 1, tileId: "wooden-door" } : { x, y: 1, tileId: "stone-wall" }));
    const map = await dm.post("/api/battle-maps").send({ name: "Door Room", width: 10, height: 10, tiles });
    return { dm, worldId, mapId: map.body.id as string };
  }

  it("blocks a monster beyond a closed door from a non-owner, and reveals it once opened", async () => {
    const { dm, worldId, mapId } = await setupWorldWithDoor("doordm1");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("doorplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0, visionRadiusFeet: 30 },
        { id: "beyond", name: "Hidden Goblin", kind: "monster", initiative: 8, conditions: [], notes: "", hpVisible: false, gridX: 5, gridY: 3 },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const before = await player.get(`/api/encounters/${worldId}`);
    expect(before.body.combatants.map((c: { name: string }) => c.name)).not.toContain("Hidden Goblin");

    const toggle = await player.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 5, y: 1 });
    expect(toggle.status).toBe(200);
    expect(toggle.body.openDoorCells).toContain("5,1");

    const after = await player.get(`/api/encounters/${worldId}`);
    expect(after.body.combatants.map((c: { name: string }) => c.name)).toContain("Hidden Goblin");
  });

  it("blocks move-grid through a closed door for a non-owner, allows it once open", async () => {
    const { dm, worldId, mapId } = await setupWorldWithDoor("doordm2");
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("doorplayer2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0, speedFeet: 30 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const blocked = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "pc1", gridX: 5, gridY: 3 });
    expect(blocked.status).toBe(400);

    await player.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 5, y: 1 });
    const allowed = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "pc1", gridX: 5, gridY: 3 });
    expect(allowed.status).toBe(200);
  });

  it("toggles closed again on a second call", async () => {
    const { dm, worldId, mapId } = await setupWorldWithDoor("doordm3");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    const opened = await dm.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 5, y: 1 });
    expect(opened.body.openDoorCells).toContain("5,1");
    const closed = await dm.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 5, y: 1 });
    expect(closed.body.openDoorCells).not.toContain("5,1");
  });

  it("rejects toggling a cell with no door", async () => {
    const { dm, worldId, mapId } = await setupWorldWithDoor("doordm4");
    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    const res = await dm.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 0, y: 0 });
    expect(res.status).toBe(400);
  });

  it("resets open door state when the active battle map changes", async () => {
    const { dm, worldId, mapId } = await setupWorldWithDoor("doordm5");
    const map2 = await dm.post("/api/battle-maps").send({ name: "Other Room", width: 10, height: 10 });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0 }],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });
    await dm.post(`/api/encounters/${worldId}/toggle-door`).send({ x: 5, y: 1 });

    const switched = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "pc1", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 1, gridY: 1 }],
      round: 1, turnIndex: 0, activeBattleMapId: map2.body.id,
    });
    expect(switched.body.openDoorCells).toEqual([]);
  });
});

describe("grid combat: elevation", () => {
  it("lets a flying combatant cross a negative-elevation gap that blocks a grounded one via move-grid", async () => {
    const { agent: dm } = await signupAgent("elevdm1");
    const world = await dm.post("/api/worlds").send({ name: "Chasm World" });
    const worldId = world.body.id as string;
    // A wall spans the whole row at y=1 except for an open-air chasm gap
    // at x=5 (negative elevation) — same "wall off the detour" technique
    // the door tests above use.
    const tiles = Array.from({ length: 10 }, (_, x) => (x === 5 ? { x, y: 1, tileId: "chasm", elevation: -20 } : { x, y: 1, tileId: "stone-wall" }));
    const map = await dm.post("/api/battle-maps").send({ name: "Chasm Room", width: 10, height: 10, tiles });
    const mapId = map.body.id as string;

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("elevplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [
        { id: "grounded", name: "Fighter", kind: "playerCharacter", initiative: 10, conditions: [], notes: "", hpVisible: true, gridX: 5, gridY: 0, speedFeet: 30 },
        { id: "flier", name: "Aarakocra", kind: "monster", initiative: 12, conditions: [], notes: "", hpVisible: false, gridX: 4, gridY: 0, speedFeet: 30, flying: true },
      ],
      round: 1, turnIndex: 0, activeBattleMapId: mapId,
    });

    const groundedMove = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "grounded", gridX: 5, gridY: 3 });
    expect(groundedMove.status).toBe(400);

    const flierMove = await player.post(`/api/encounters/${worldId}/move-grid`).send({ combatantId: "flier", gridX: 4, gridY: 3 });
    expect(flierMove.status).toBe(200);
  });

  it("round-trips a combatant's flying flag through PUT", async () => {
    const { agent: dm } = await signupAgent("elevdm2");
    const world = await dm.post("/api/worlds").send({ name: "Flying Test World" });
    const worldId = world.body.id as string;

    const put = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{ id: "bird", name: "Owl", kind: "monster", initiative: 5, conditions: [], notes: "", hpVisible: false, flying: true }],
      round: 1, turnIndex: 0,
    });
    expect(put.body.combatants[0].flying).toBe(true);

    const get = await dm.get(`/api/encounters/${worldId}`);
    expect(get.body.combatants[0].flying).toBe(true);
  });

  it("round-trips a combatant's spellcasting snapshot (preparedSpells/spellSlots/spellSaveDc/spellAttackBonus) through PUT", async () => {
    const { agent: dm } = await signupAgent("spellcasterdm1");
    const world = await dm.post("/api/worlds").send({ name: "Spellcasting Test World" });
    const worldId = world.body.id as string;

    const put = await dm.put(`/api/encounters/${worldId}`).send({
      combatants: [{
        id: "wiz", name: "Elowen", kind: "playerCharacter", initiative: 8, conditions: [], notes: "", hpVisible: true,
        preparedSpells: ["fire-bolt", "burning-hands"],
        spellSlots: [{ level: 1, max: 2, current: 2 }],
        spellSaveDc: 13,
        spellAttackBonus: 5,
      }],
      round: 1, turnIndex: 0,
    });
    expect(put.body.combatants[0].preparedSpells).toEqual(["fire-bolt", "burning-hands"]);
    expect(put.body.combatants[0].spellSlots).toEqual([{ level: 1, max: 2, current: 2 }]);
    expect(put.body.combatants[0].spellSaveDc).toBe(13);
    expect(put.body.combatants[0].spellAttackBonus).toBe(5);

    const get = await dm.get(`/api/encounters/${worldId}`);
    expect(get.body.combatants[0].preparedSpells).toEqual(["fire-bolt", "burning-hands"]);
    expect(get.body.combatants[0].spellSlots).toEqual([{ level: 1, max: 2, current: 2 }]);
  });

  it("round-trips a placed tile's elevation through the battle-maps route", async () => {
    const { agent: dm } = await signupAgent("elevdm3");
    const created = await dm.post("/api/battle-maps").send({
      name: "Ledge Room",
      width: 10,
      height: 10,
      tiles: [{ x: 3, y: 3, tileId: "grass", elevation: 15 }],
    });
    expect(created.body.tiles[0].elevation).toBe(15);

    const fetched = await dm.get(`/api/battle-maps/${created.body.id}`);
    expect(fetched.body.tiles[0].elevation).toBe(15);
  });
});

describe("move-zone adjacency", () => {
  // A zone link is stored on one zone but means the same thing from either
  // end, so this route and the client's zone map have to agree on what
  // counts as adjacent — they share areZonesAdjacent for exactly that
  // reason. Untested at the route level until now.
  async function seedZonedEncounter(username: string, zones: unknown[]) {
    const { agent } = await signupAgent(username);
    const world = await agent.post("/api/worlds").send({ name: `${username} World` });
    const worldId = world.body.id as string;
    const combatants = [
      { id: "pc-1", name: "Wren", kind: "playerCharacter", initiative: 15, maxHp: 20, currentHp: 20, conditions: [], notes: "", hpVisible: true, zoneId: "a" },
    ];
    await agent.put(`/api/encounters/${worldId}`).send({ combatants, round: 1, turnIndex: 0, zones, zoneEffects: [] });
    return { agent, worldId };
  }

  const zone = (id: string, connections: string[] = []) =>
    ({ id, name: id, tags: [], x: 0, y: 0, connections, revealed: true });

  it("allows a move across a link listed by the origin zone", async () => {
    const { agent, worldId } = await seedZonedEncounter("zonemove1", [zone("a", ["b"]), zone("b")]);
    const res = await agent.post(`/api/encounters/${worldId}/move-zone`).send({ combatantId: "pc-1", zoneId: "b" });
    expect(res.status).toBe(200);
    expect(res.body.combatants[0].zoneId).toBe("b");
  });

  it("allows a move across a link listed only by the destination zone", async () => {
    const { agent, worldId } = await seedZonedEncounter("zonemove2", [zone("a"), zone("b", ["a"])]);
    const res = await agent.post(`/api/encounters/${worldId}/move-zone`).send({ combatantId: "pc-1", zoneId: "b" });
    expect(res.status).toBe(200);
    expect(res.body.combatants[0].zoneId).toBe("b");
  });

  it("rejects a move to an unlinked zone", async () => {
    const { agent, worldId } = await seedZonedEncounter("zonemove3", [zone("a"), zone("b")]);
    const res = await agent.post(`/api/encounters/${worldId}/move-zone`).send({ combatantId: "pc-1", zoneId: "b" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/adjacent/i);
  });

  it("rejects a two-hop move even though a path exists", async () => {
    const { agent, worldId } = await seedZonedEncounter("zonemove4", [zone("a", ["b"]), zone("b", ["c"]), zone("c")]);
    const res = await agent.post(`/api/encounters/${worldId}/move-zone`).send({ combatantId: "pc-1", zoneId: "c" });
    expect(res.status).toBe(400);
  });

  it("404s a move to a zone that isn't on the map", async () => {
    const { agent, worldId } = await seedZonedEncounter("zonemove5", [zone("a", ["b"]), zone("b")]);
    const res = await agent.post(`/api/encounters/${worldId}/move-zone`).send({ combatantId: "pc-1", zoneId: "nowhere" });
    expect(res.status).toBe(404);
  });
});

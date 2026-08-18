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

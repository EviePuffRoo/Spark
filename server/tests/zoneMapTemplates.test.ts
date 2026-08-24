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

describe("zone map templates", () => {
  it("hides an unrevealed zone's content from a non-owner party member, but not the creator", async () => {
    const { agent: dm } = await signupAgent("templatedm1");
    const world = await dm.post("/api/worlds").send({ name: "Template World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("templateplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const zones = [
      { id: "z1", name: "Entry Hall", tags: [], x: 0, y: 0, connections: ["z2"], revealed: true },
      { id: "z2", name: "Secret Vault", tags: [], x: 100, y: 0, connections: ["z1"], revealed: false, hazard: { label: "Pressure plate trap", damage: 12 } },
    ];
    const created = await dm.post("/api/zone-map-templates").send({ name: "Dungeon Wing", zones, worldId });
    expect(created.status).toBe(201);
    const templateId = created.body.id as string;

    const ownerGet = await dm.get(`/api/zone-map-templates/${templateId}`);
    expect(ownerGet.body.zones.map((z: { id: string }) => z.id)).toEqual(["z1", "z2"]);

    const playerGet = await player.get(`/api/zone-map-templates/${templateId}`);
    expect(playerGet.status).toBe(200);
    const playerZoneIds = playerGet.body.zones.map((z: { id: string }) => z.id);
    expect(playerZoneIds).toEqual(["z1"]);
    // The visible zone's own connections shouldn't leak a reference to the
    // unrevealed one either.
    expect(playerGet.body.zones[0].connections).toEqual([]);

    const playerList = await player.get(`/api/zone-map-templates?worldId=${worldId}`);
    expect(playerList.body[0].zones.map((z: { id: string }) => z.id)).toEqual(["z1"]);
  });
});

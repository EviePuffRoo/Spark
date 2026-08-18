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

// A world's owner never gets a WorldMember row for their own world (there's
// no self-join step at world-creation time), so getMemberWorldIds used to
// only cover worlds joined as a non-owner member. Every route that scopes
// by "worldId in memberWorldIds" — search, per-world entity listing, VTT
// export, links — would silently miss entities another member saved into a
// world the caller owns but never explicitly joined.
describe("world owner sees other members' entities without an explicit membership row", () => {
  it("finds another player's player character via search in a world the caller owns", async () => {
    const { agent: dm } = await signupAgent("dm1");
    const world = await dm.post("/api/worlds").send({ name: "Owner Search World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("player1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });
    const pc = await player.post("/api/player-characters").send({
      name: "Zylara Windrider", className: "Ranger", level: 1, race: "Elf", armorClass: 14, maxHp: 10, worldId,
    });
    expect(pc.status).toBe(201);

    const results = await dm.get("/api/search").query({ q: "Zylara", type: "playerCharacter" });
    expect(results.status).toBe(200);
    expect(results.body.results.map((r: { id: string }) => r.id)).toContain(pc.body.id);
  });

  it("lists another player's player character when the caller owns the world", async () => {
    const { agent: dm } = await signupAgent("dm2");
    const world = await dm.post("/api/worlds").send({ name: "Owner List World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("player2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });
    const pc = await player.post("/api/player-characters").send({
      name: "Bram Ironfoot", className: "Fighter", level: 1, race: "Dwarf", armorClass: 16, maxHp: 12, worldId,
    });

    const listed = await dm.get("/api/player-characters").query({ worldId });
    expect(listed.status).toBe(200);
    expect(listed.body.map((r: { id: string }) => r.id)).toContain(pc.body.id);
  });

  it("does not leak entities from a world the caller has no access to at all", async () => {
    const { agent: dm } = await signupAgent("dm3");
    const world = await dm.post("/api/worlds").send({ name: "Private World" });
    const worldId = world.body.id as string;
    const pc = await dm.post("/api/player-characters").send({
      name: "Unrelated Character", className: "Wizard", level: 1, race: "Human", armorClass: 12, maxHp: 8, worldId,
    });

    const { agent: outsider } = await signupAgent("outsider1");
    const results = await outsider.get("/api/search").query({ q: "Unrelated", type: "playerCharacter" });
    expect(results.body.results.map((r: { id: string }) => r.id)).not.toContain(pc.body.id);
  });
});

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

describe("battle maps", () => {
  it("400s creation with no name, or dimensions past the caps", async () => {
    const { agent } = await signupAgent("mapuser1");

    const noName = await agent.post("/api/battle-maps").send({ width: 10, height: 10 });
    expect(noName.status).toBe(400);

    const tooWide = await agent.post("/api/battle-maps").send({ name: "Too Wide", width: 999, height: 10 });
    expect(tooWide.status).toBe(400);

    const tooTall = await agent.post("/api/battle-maps").send({ name: "Too Tall", width: 10, height: 999 });
    expect(tooTall.status).toBe(400);
  });

  it("creates a battle map with default empty tiles", async () => {
    const { agent } = await signupAgent("mapuser2");
    const res = await agent.post("/api/battle-maps").send({ name: "Goblin Ambush", width: 12, height: 8 });
    expect(res.status).toBe(201);
    expect(res.body.tiles).toEqual([]);
    expect(res.body.width).toBe(12);
    expect(res.body.height).toBe(8);
  });

  it("silently drops out-of-bounds tiles and unknown tile ids", async () => {
    const { agent } = await signupAgent("mapuser3");
    const res = await agent.post("/api/battle-maps").send({
      name: "Bad Tiles",
      width: 5,
      height: 5,
      tiles: [
        { x: 0, y: 0, tileId: "stone-floor" },
        { x: 10, y: 10, tileId: "stone-floor" },
        { x: 1, y: 1, tileId: "not-a-real-tile" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.tiles).toEqual([{ x: 0, y: 0, tileId: "stone-floor" }]);
  });

  it("403s creating a map attached to a world you don't have access to", async () => {
    const { agent: owner } = await signupAgent("mapowner1");
    const world = await owner.post("/api/worlds").send({ name: "Private World" });

    const { agent: outsider } = await signupAgent("mapoutsider1");
    const res = await outsider.post("/api/battle-maps").send({ name: "Sneaky Map", width: 5, height: 5, worldId: world.body.id });
    expect(res.status).toBe(403);
  });

  it("lists only your own maps and world-visible ones, hiding hiddenFromParty from non-owners", async () => {
    const { agent: dm } = await signupAgent("mapdm1");
    const world = await dm.post("/api/worlds").send({ name: "Shared World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("mapplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.post("/api/battle-maps").send({ name: "Visible Map", width: 5, height: 5, worldId });
    await dm.post("/api/battle-maps").send({ name: "DM Secret Map", width: 5, height: 5, worldId, hiddenFromParty: true });

    const list = await player.get(`/api/battle-maps?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body.map((m: { name: string }) => m.name)).toEqual(["Visible Map"]);
  });

  it("updates name and tiles via PATCH, re-validating against the map's own dimensions", async () => {
    const { agent } = await signupAgent("mapuser4");
    const created = await agent.post("/api/battle-maps").send({ name: "Original", width: 4, height: 4 });
    const id = created.body.id as string;

    const patched = await agent.patch(`/api/battle-maps/${id}`).send({
      name: "Renamed",
      tiles: [{ x: 0, y: 0, tileId: "grass" }, { x: 3, y: 3, tileId: "stone-wall" }, { x: 9, y: 9, tileId: "grass" }],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe("Renamed");
    expect(patched.body.tiles).toEqual([{ x: 0, y: 0, tileId: "grass" }, { x: 3, y: 3, tileId: "stone-wall" }]);
  });

  it("404s PATCH/DELETE from a non-owner", async () => {
    const { agent: owner } = await signupAgent("mapowner2");
    const created = await owner.post("/api/battle-maps").send({ name: "Owned Map", width: 5, height: 5 });
    const id = created.body.id as string;

    const { agent: outsider } = await signupAgent("mapoutsider2");
    const patch = await outsider.patch(`/api/battle-maps/${id}`).send({ name: "Hijacked" });
    expect(patch.status).toBe(404);
    const del = await outsider.delete(`/api/battle-maps/${id}`);
    expect(del.status).toBe(404);
  });

  it("strips gmOnly markers from a world-shared map for a non-owner, keeping them (with notes) for the owner", async () => {
    const { agent: dm } = await signupAgent("mapdm2");
    const world = await dm.post("/api/worlds").send({ name: "GM Layer World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("mapplayer2");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const created = await dm.post("/api/battle-maps").send({
      name: "Dungeon Room", width: 6, height: 6, worldId,
      tiles: [
        { x: 0, y: 0, tileId: "stone-floor" },
        { x: 3, y: 3, tileId: "hidden-trap", layer: "gmOnly", note: "Poison needle, DC 15" },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.tiles).toHaveLength(2);
    const mapId = created.body.id as string;

    const dmGet = await dm.get(`/api/battle-maps/${mapId}`);
    expect(dmGet.body.tiles).toHaveLength(2);
    expect(dmGet.body.tiles.find((t: { layer?: string }) => t.layer === "gmOnly")?.note).toBe("Poison needle, DC 15");

    const playerGet = await player.get(`/api/battle-maps/${mapId}`);
    expect(playerGet.status).toBe(200);
    expect(playerGet.body.tiles).toEqual([{ x: 0, y: 0, tileId: "stone-floor" }]);

    const playerList = await player.get(`/api/battle-maps?worldId=${worldId}`);
    const listed = playerList.body.find((m: { id: string }) => m.id === mapId);
    expect(listed.tiles).toEqual([{ x: 0, y: 0, tileId: "stone-floor" }]);
  });

  it("deletes a map you own", async () => {
    const { agent } = await signupAgent("mapuser5");
    const created = await agent.post("/api/battle-maps").send({ name: "Doomed Map", width: 5, height: 5 });
    const id = created.body.id as string;

    const del = await agent.delete(`/api/battle-maps/${id}`);
    expect(del.status).toBe(204);

    const row = await prisma.battleMap.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it("403s a free-tier account's 4th battle map with a machine-readable code, but lets a paid account past it", async () => {
    const { agent, userId } = await signupAgent("mapfreecap1");
    for (let i = 0; i < 3; i++) {
      const res = await agent.post("/api/battle-maps").send({ name: `Map ${i}`, width: 5, height: 5 });
      expect(res.status).toBe(201);
    }
    const blocked = await agent.post("/api/battle-maps").send({ name: "Map 4", width: 5, height: 5 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("battlemap_limit");

    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
    const allowed = await agent.post("/api/battle-maps").send({ name: "Map 4 (paid)", width: 5, height: 5 });
    expect(allowed.status).toBe(201);
  });
});

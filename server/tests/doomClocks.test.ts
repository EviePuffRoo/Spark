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

describe("doom clocks", () => {
  it("creates a clock and lists it for the owner", async () => {
    const { agent: dm } = await signupAgent("clockdm1");
    const world = await dm.post("/api/worlds").send({ name: "Doom World" });
    const worldId = world.body.id as string;

    const created = await dm.post("/api/doom-clocks").send({ worldId, label: "The Ritual Completes", segments: 6 });
    expect(created.status).toBe(201);
    expect(created.body.filled).toBe(0);
    expect(created.body.visibleToParty).toBe(false);

    const list = await dm.get(`/api/doom-clocks?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("400s an invalid segment count", async () => {
    const { agent: dm } = await signupAgent("clockdm2");
    const world = await dm.post("/api/worlds").send({ name: "Doom World 2" });
    const worldId = world.body.id as string;

    const tooFew = await dm.post("/api/doom-clocks").send({ worldId, label: "Bad", segments: 1 });
    expect(tooFew.status).toBe(400);
    const tooMany = await dm.post("/api/doom-clocks").send({ worldId, label: "Bad", segments: 21 });
    expect(tooMany.status).toBe(400);
  });

  it("hides a party-invisible clock from a member but shows a visible one", async () => {
    const { agent: dm } = await signupAgent("clockdm3");
    const world = await dm.post("/api/worlds").send({ name: "Doom World 3" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("clockplayer3");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.post("/api/doom-clocks").send({ worldId, label: "Secret Clock", segments: 4, visibleToParty: false });
    await dm.post("/api/doom-clocks").send({ worldId, label: "Public Clock", segments: 4, visibleToParty: true });

    const ownerList = await dm.get(`/api/doom-clocks?worldId=${worldId}`);
    expect(ownerList.body).toHaveLength(2);

    const playerList = await player.get(`/api/doom-clocks?worldId=${worldId}`);
    expect(playerList.body).toHaveLength(1);
    expect(playerList.body[0].label).toBe("Public Clock");
  });

  it("advance clamps at segments and never goes below zero", async () => {
    const { agent: dm } = await signupAgent("clockdm4");
    const world = await dm.post("/api/worlds").send({ name: "Doom World 4" });
    const worldId = world.body.id as string;
    const clock = await dm.post("/api/doom-clocks").send({ worldId, label: "Clock", segments: 3 });
    const id = clock.body.id as string;

    await dm.post(`/api/doom-clocks/${id}/advance`).send({ amount: 2 });
    const overfill = await dm.post(`/api/doom-clocks/${id}/advance`).send({ amount: 5 });
    expect(overfill.body.filled).toBe(3);

    await dm.post(`/api/doom-clocks/${id}/reset`);
    const underfill = await dm.post(`/api/doom-clocks/${id}/advance`).send({ amount: -5 });
    expect(underfill.body.filled).toBe(0);
  });

  it("shrinking segments below the current fill clamps fill down with it", async () => {
    const { agent: dm } = await signupAgent("clockdm5");
    const world = await dm.post("/api/worlds").send({ name: "Doom World 5" });
    const worldId = world.body.id as string;
    const clock = await dm.post("/api/doom-clocks").send({ worldId, label: "Clock", segments: 8 });
    const id = clock.body.id as string;
    await dm.post(`/api/doom-clocks/${id}/advance`).send({ amount: 6 });

    const patched = await dm.patch(`/api/doom-clocks/${id}`).send({ segments: 4 });
    expect(patched.status).toBe(200);
    expect(patched.body.segments).toBe(4);
    expect(patched.body.filled).toBe(4);
  });

  it("404s writes from a non-owner and lets the owner delete", async () => {
    const { agent: dm } = await signupAgent("clockdm6");
    const world = await dm.post("/api/worlds").send({ name: "Doom World 6" });
    const worldId = world.body.id as string;
    const clock = await dm.post("/api/doom-clocks").send({ worldId, label: "Clock", segments: 4 });
    const id = clock.body.id as string;

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("clockplayer6");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const playerAdvance = await player.post(`/api/doom-clocks/${id}/advance`).send({ amount: 1 });
    expect(playerAdvance.status).toBe(404);
    const playerPatch = await player.patch(`/api/doom-clocks/${id}`).send({ label: "Hijacked" });
    expect(playerPatch.status).toBe(404);
    const playerDelete = await player.delete(`/api/doom-clocks/${id}`);
    expect(playerDelete.status).toBe(404);

    const ownerDelete = await dm.delete(`/api/doom-clocks/${id}`);
    expect(ownerDelete.status).toBe(204);
    const list = await dm.get(`/api/doom-clocks?worldId=${worldId}`);
    expect(list.body).toHaveLength(0);
  });
});

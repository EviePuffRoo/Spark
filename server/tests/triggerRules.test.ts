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

// Creating a trigger rule is a paid feature (gated on the world owner's
// tier), so every DM below needs paid tier to exercise the CRUD behavior
// this suite actually tests. The dedicated free-tier gate test at the end
// covers the free-tier-blocked case.
async function paidDM(username: string) {
  const { agent, userId } = await signupAgent(username);
  await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
  return { agent, userId };
}

describe("trigger rules", () => {
  it("creates a rule and lists it for the owner", async () => {
    const { agent: dm } = await paidDM("triggerdm1");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World" });
    const worldId = world.body.id as string;

    const created = await dm.post("/api/trigger-rules").send({
      worldId, name: "Bloodied", message: "The boss is bloodied!",
      condition: { kind: "hpBelowPercent", threshold: 50 },
    });
    expect(created.status).toBe(201);
    expect(created.body.enabled).toBe(true);
    expect(created.body.condition).toEqual({ kind: "hpBelowPercent", threshold: 50 });

    const list = await dm.get(`/api/trigger-rules?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("400s a missing name, message, or invalid condition", async () => {
    const { agent: dm } = await paidDM("triggerdm2");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World 2" });
    const worldId = world.body.id as string;

    const noName = await dm.post("/api/trigger-rules").send({
      worldId, message: "x", condition: { kind: "roundReached", threshold: 3 },
    });
    expect(noName.status).toBe(400);

    const noMessage = await dm.post("/api/trigger-rules").send({
      worldId, name: "x", condition: { kind: "roundReached", threshold: 3 },
    });
    expect(noMessage.status).toBe(400);

    const badCondition = await dm.post("/api/trigger-rules").send({
      worldId, name: "x", message: "x", condition: { kind: "notAKind" },
    });
    expect(badCondition.status).toBe(400);
  });

  it("hides a disabled rule from a member but shows an enabled one", async () => {
    const { agent: dm } = await paidDM("triggerdm3");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World 3" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("triggerplayer3");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    await dm.post("/api/trigger-rules").send({
      worldId, name: "Draft", message: "shh", enabled: false,
      condition: { kind: "roundReached", threshold: 1 },
    });
    await dm.post("/api/trigger-rules").send({
      worldId, name: "Live", message: "go", enabled: true,
      condition: { kind: "roundReached", threshold: 1 },
    });

    const ownerList = await dm.get(`/api/trigger-rules?worldId=${worldId}`);
    expect(ownerList.body).toHaveLength(2);

    const playerList = await player.get(`/api/trigger-rules?worldId=${worldId}`);
    expect(playerList.body).toHaveLength(1);
    expect(playerList.body[0].name).toBe("Live");
  });

  it("patches name, condition, and enabled", async () => {
    const { agent: dm } = await paidDM("triggerdm4");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World 4" });
    const worldId = world.body.id as string;
    const rule = await dm.post("/api/trigger-rules").send({
      worldId, name: "Original", message: "m",
      condition: { kind: "hpBelowValue", threshold: 10 },
    });
    const id = rule.body.id as string;

    const patched = await dm.patch(`/api/trigger-rules/${id}`).send({
      name: "Renamed", enabled: false, condition: { kind: "roundReached", threshold: 5 },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe("Renamed");
    expect(patched.body.enabled).toBe(false);
    expect(patched.body.condition).toEqual({ kind: "roundReached", threshold: 5 });
  });

  it("rejects a patch with an invalid condition", async () => {
    const { agent: dm } = await paidDM("triggerdm5");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World 5" });
    const worldId = world.body.id as string;
    const rule = await dm.post("/api/trigger-rules").send({
      worldId, name: "Original", message: "m",
      condition: { kind: "hpBelowValue", threshold: 10 },
    });
    const id = rule.body.id as string;

    const patched = await dm.patch(`/api/trigger-rules/${id}`).send({ condition: { kind: "bogus" } });
    expect(patched.status).toBe(400);
  });

  it("404s writes from a non-owner and lets the owner delete", async () => {
    const { agent: dm } = await paidDM("triggerdm6");
    const world = await dm.post("/api/worlds").send({ name: "Trigger World 6" });
    const worldId = world.body.id as string;
    const rule = await dm.post("/api/trigger-rules").send({
      worldId, name: "Rule", message: "m",
      condition: { kind: "roundReached", threshold: 1 },
    });
    const id = rule.body.id as string;

    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);
    const { agent: player } = await signupAgent("triggerplayer6");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const playerPatch = await player.patch(`/api/trigger-rules/${id}`).send({ name: "Hijacked" });
    expect(playerPatch.status).toBe(404);
    const playerDelete = await player.delete(`/api/trigger-rules/${id}`);
    expect(playerDelete.status).toBe(404);

    const ownerDelete = await dm.delete(`/api/trigger-rules/${id}`);
    expect(ownerDelete.status).toBe(204);
    const list = await dm.get(`/api/trigger-rules?worldId=${worldId}`);
    expect(list.body).toHaveLength(0);
  });

  it("403s creating a rule for a free-tier world with a machine-readable code", async () => {
    const { agent: dm } = await signupAgent("triggerdmfree1");
    const world = await dm.post("/api/worlds").send({ name: "Free Trigger World" });
    const worldId = world.body.id as string;

    const res = await dm.post("/api/trigger-rules").send({
      worldId, name: "Bloodied", message: "The boss is bloodied!",
      condition: { kind: "hpBelowPercent", threshold: 50 },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("trigger_rules_paid_only");
  });
});

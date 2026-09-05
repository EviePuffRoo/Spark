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

// Join codes are stored as bcrypt hashes, so they can't be looked up by
// value directly. Resolving a submitted code by comparing it against every
// world that has one costs a bcrypt comparison per world (~90ms each) —
// which makes a single join attempt slower for everyone as the number of
// worlds on the instance grows, and makes repeated bogus attempts a cheap
// way to tie up the server.
describe("joining a world by code, with many worlds on the instance", () => {
  it("resolves a code without getting slower as unrelated worlds accumulate", async () => {
    const { agent: owner, userId } = await signupAgent("scalingdm");
    // Past the free tier's 3-world cap, so all 30 actually get created.
    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });

    // 30 worlds all carrying a join code; the one we'll actually join is
    // created last, so a linear scan hits it on the final comparison.
    let lastCode = "";
    for (let i = 0; i < 30; i++) {
      const world = await owner.post("/api/worlds").send({ name: `World ${i}` });
      const res = await owner.post(`/api/worlds/${world.body.id}/join-code`);
      lastCode = res.body.code;
    }

    const { agent: joiner } = await signupAgent("scalingjoiner");
    const started = Date.now();
    const joined = await joiner.post("/api/worlds/join").send({ code: lastCode });
    const elapsed = Date.now() - started;

    expect(joined.status).toBe(201);
    expect(joined.body.worldName).toBe("World 29");
    // A scan over 30 worlds costs ~2.7s here; a direct lookup is one
    // comparison. The bound is loose enough not to be flaky on a slow
    // machine while still failing the scan.
    expect(elapsed).toBeLessThan(1500);
  });

  it("still rejects a code that matches no world", async () => {
    const { agent: owner } = await signupAgent("scalingdm2");
    const world = await owner.post("/api/worlds").send({ name: "Real World" });
    await owner.post(`/api/worlds/${world.body.id}/join-code`);

    const { agent: joiner } = await signupAgent("scalingjoiner2");
    const res = await joiner.post("/api/worlds/join").send({ code: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" });
    expect(res.status).toBe(404);
  });

  it("accepts a code issued before the lookup column existed", async () => {
    // Worlds whose code was hashed by the previous implementation have no
    // lookup value and can never get one — the plaintext is gone. Their
    // codes must keep working.
    const { agent: owner, userId } = await signupAgent("legacydm");
    const world = await owner.post("/api/worlds").send({ name: "Legacy World" });
    await owner.post(`/api/worlds/${world.body.id}/join-code`).send({ role: "coDM" });
    const issued = await prisma.world.findUnique({ where: { id: world.body.id } });

    // Simulate the pre-migration row shape: hash present, lookup absent.
    await prisma.world.update({
      where: { id: world.body.id },
      data: { joinCodeLookup: null },
    });
    expect(issued!.joinCodeHash).toBeTruthy();

    const code = (await owner.post(`/api/worlds/${world.body.id}/join-code`)).body.code;
    await prisma.world.update({ where: { id: world.body.id }, data: { joinCodeLookup: null } });

    const { agent: joiner } = await signupAgent("legacyjoiner");
    const res = await joiner.post("/api/worlds/join").send({ code });
    expect(res.status).toBe(201);
    expect(res.body.worldName).toBe("Legacy World");

    const membership = await prisma.worldMember.findFirst({ where: { worldId: world.body.id } });
    expect(membership!.role).toBe("player");
    expect(userId).toBeTruthy();
  });
});

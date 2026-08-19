import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("signup/login", () => {
  it("signs up, returns a recovery code, and sets a session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "alice", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe("alice");
    expect(res.body.tier).toBe("free");
    expect(res.body.role).toBe("user");
    expect(res.body.recoveryCode).toMatch(/^[A-Z0-9-]+$/);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a duplicate username", async () => {
    await request(app).post("/api/auth/signup").send({ username: "bob", password: "password123" });
    const res = await request(app).post("/api/auth/signup").send({ username: "bob", password: "password123" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/auth/signup").send({ username: "carol", password: "password123" });

    const bad = await request(app).post("/api/auth/login").send({ username: "carol", password: "wrong" });
    expect(bad.status).toBe(401);

    const good = await request(app).post("/api/auth/login").send({ username: "carol", password: "password123" });
    expect(good.status).toBe(200);
    expect(good.body.username).toBe("carol");
  });

  it("rejects login for a username that was never signed up, same as a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "nobody-here", password: "whatever123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect username or password.");
  });

  it("promotes the configured ADMIN_USERNAMES account to admin on signup, and no one else", async () => {
    // vitest.config.ts sets ADMIN_USERNAMES=admintestuser — auth.ts reads it
    // once at module load, so this asserts against that fixed value rather
    // than mutating process.env mid-process (which auth.ts wouldn't see).
    const admin = await request(app).post("/api/auth/signup").send({ username: "admintestuser", password: "password123" });
    expect(admin.body.role).toBe("admin");

    const regular = await request(app).post("/api/auth/signup").send({ username: "regularuser", password: "password123" });
    expect(regular.body.role).toBe("user");
  });
});

describe("authenticated session", () => {
  async function signupAgent(username: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username, password: "password123" });
    return agent;
  }

  it("rejects unauthenticated requests to protected routes", async () => {
    const res = await request(app).get("/api/worlds");
    expect(res.status).toBe(401);
  });

  it("allows an authenticated request via the session cookie", async () => {
    const agent = await signupAgent("eve");
    const res = await agent.get("/api/worlds");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("logs out and revokes access", async () => {
    const agent = await signupAgent("frank");
    await agent.post("/api/auth/logout");
    const res = await agent.get("/api/worlds");
    expect(res.status).toBe(401);
  });
});

describe("change password / recovery code", () => {
  async function signupAgent(username: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username, password: "password123" });
    return agent;
  }

  it("rejects a change-password call with the wrong current password", async () => {
    const agent = await signupAgent("grace");
    const res = await agent.post("/api/auth/change-password").send({ currentPassword: "nope", newPassword: "newpassword1" });
    expect(res.status).toBe(401);
  });

  it("changes the password and the old password stops working", async () => {
    const agent = await signupAgent("heidi");
    const changeRes = await agent.post("/api/auth/change-password").send({ currentPassword: "password123", newPassword: "newpassword1" });
    expect(changeRes.status).toBe(204);

    const oldLogin = await request(app).post("/api/auth/login").send({ username: "heidi", password: "password123" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ username: "heidi", password: "newpassword1" });
    expect(newLogin.status).toBe(200);
  });

  it("resets a password using a valid recovery code", async () => {
    const signup = await request(app).post("/api/auth/signup").send({ username: "ivan", password: "password123" });
    const recoveryCode = signup.body.recoveryCode as string;

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ username: "ivan", recoveryCode, newPassword: "brandnewpass1" });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCode).toBeTruthy();
    expect(res.body.recoveryCode).not.toBe(recoveryCode);

    const login = await request(app).post("/api/auth/login").send({ username: "ivan", password: "brandnewpass1" });
    expect(login.status).toBe(200);
  });

  it("rejects a reset-password call with a stale/wrong recovery code", async () => {
    await request(app).post("/api/auth/signup").send({ username: "judy", password: "password123" });
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ username: "judy", recoveryCode: "WRONG-CODE-0000-0000", newPassword: "brandnewpass1" });
    expect(res.status).toBe(401);
  });

  it("rejects reset-password for a username that was never signed up, same as a wrong code", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ username: "nobody-here", recoveryCode: "WRONG-CODE-0000-0000", newPassword: "brandnewpass1" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("That username and recovery code don't match.");
  });
});

describe("display name", () => {
  async function signupAgent(username: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username, password: "password123" });
    return agent;
  }

  it("defaults to null and can be set, trimmed, and read back via /auth/me", async () => {
    const agent = await signupAgent("mallory");
    const fresh = await agent.get("/api/auth/me");
    expect(fresh.body.displayName).toBeNull();

    const patched = await agent.patch("/api/auth/me").send({ displayName: "  Mal the Mysterious  " });
    expect(patched.status).toBe(200);
    expect(patched.body.displayName).toBe("Mal the Mysterious");

    const reread = await agent.get("/api/auth/me");
    expect(reread.body.displayName).toBe("Mal the Mysterious");
  });

  it("clears back to null on an empty/whitespace-only value", async () => {
    const agent = await signupAgent("nathan");
    await agent.patch("/api/auth/me").send({ displayName: "Nate" });
    const cleared = await agent.patch("/api/auth/me").send({ displayName: "   " });
    expect(cleared.status).toBe(200);
    expect(cleared.body.displayName).toBeNull();
  });

  it("rejects a display name over 40 characters", async () => {
    const agent = await signupAgent("olivia");
    const res = await agent.patch("/api/auth/me").send({ displayName: "x".repeat(41) });
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).patch("/api/auth/me").send({ displayName: "Nope" });
    expect(res.status).toBe(401);
  });
});

describe("account deletion", () => {
  it("rejects deletion with the wrong password and leaves the account intact", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username: "kim", password: "password123" });

    const res = await agent.delete("/api/auth/me").send({ password: "wrong" });
    expect(res.status).toBe(401);

    const stillThere = await prisma.user.findUnique({ where: { username: "kim" } });
    expect(stillThere).not.toBeNull();
  });

  it("deletes the account and cascades to owned rows", async () => {
    const agent = request.agent(app);
    const signup = await agent.post("/api/auth/signup").send({ username: "liam", password: "password123" });
    const userId = signup.body.id as string;

    const world = await agent.post("/api/worlds").send({ name: "Doomed World" });
    expect(world.status).toBe(201);

    const del = await agent.delete("/api/auth/me").send({ password: "password123" });
    expect(del.status).toBe(204);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeNull();
    const worlds = await prisma.world.findMany({ where: { userId } });
    expect(worlds).toHaveLength(0);

    // The username is freed up for reuse.
    const resignup = await request(app).post("/api/auth/signup").send({ username: "liam", password: "password123" });
    expect(resignup.status).toBe(201);
  });
});

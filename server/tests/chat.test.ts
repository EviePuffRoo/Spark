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

describe("chat", () => {
  it("400s a post with no worldId or empty text", async () => {
    const { agent } = await signupAgent("chatuser1");
    const world = await agent.post("/api/worlds").send({ name: "Chat World" });

    const missingWorld = await agent.post("/api/chat").send({ text: "hello" });
    expect(missingWorld.status).toBe(400);

    const emptyText = await agent.post("/api/chat").send({ worldId: world.body.id, text: "   " });
    expect(emptyText.status).toBe(400);
  });

  it("403s posting or listing chat for a world you don't have access to", async () => {
    const { agent: owner } = await signupAgent("chatowner1");
    const world = await owner.post("/api/worlds").send({ name: "Private World" });
    const worldId = world.body.id as string;

    const { agent: outsider } = await signupAgent("outsider1");
    const post = await outsider.post("/api/chat").send({ worldId, text: "sneaking in" });
    expect(post.status).toBe(403);

    const list = await outsider.get(`/api/chat?worldId=${worldId}`);
    expect(list.status).toBe(403);
  });

  it("posts a message using the poster's own username, not client-supplied", async () => {
    const { agent } = await signupAgent("chatuser2");
    const world = await agent.post("/api/worlds").send({ name: "Chat World 2" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/chat").send({ worldId, text: "hello party", senderName: "Someone Else" });
    expect(res.status).toBe(201);
    expect(res.body.senderName).toBe("chatuser2");
    expect(res.body.text).toBe("hello party");
  });

  it("lists messages oldest-first", async () => {
    const { agent } = await signupAgent("chatuser3");
    const world = await agent.post("/api/worlds").send({ name: "Chat World 3" });
    const worldId = world.body.id as string;

    await agent.post("/api/chat").send({ worldId, text: "first" });
    await agent.post("/api/chat").send({ worldId, text: "second" });
    await agent.post("/api/chat").send({ worldId, text: "third" });

    const list = await agent.get(`/api/chat?worldId=${worldId}`);
    expect(list.status).toBe(200);
    expect(list.body.map((m: { text: string }) => m.text)).toEqual(["first", "second", "third"]);
  });

  it("lets a world member see and post chat, not just the owner", async () => {
    const { agent: dm } = await signupAgent("chatdm1");
    const world = await dm.post("/api/worlds").send({ name: "Shared Chat World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("chatplayer1");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const dmPost = await dm.post("/api/chat").send({ worldId, text: "hello from DM" });
    expect(dmPost.status).toBe(201);
    const playerPost = await player.post("/api/chat").send({ worldId, text: "hello from player" });
    expect(playerPost.status).toBe(201);

    const list = await player.get(`/api/chat?worldId=${worldId}`);
    expect(list.body.map((m: { text: string }) => m.text)).toEqual(["hello from DM", "hello from player"]);
  });

  it("lets the sender delete their own message, and blocks other non-owner users", async () => {
    const { agent: dm } = await signupAgent("chatdm2");
    const world = await dm.post("/api/worlds").send({ name: "Delete Test World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player1 } = await signupAgent("chatplayer2");
    await player1.post("/api/worlds/join").send({ code: joinCode.body.code });
    const { agent: player2 } = await signupAgent("chatplayer3");
    await player2.post("/api/worlds/join").send({ code: joinCode.body.code });

    const msg = await player1.post("/api/chat").send({ worldId, text: "my message" });
    const msgId = msg.body.id as string;

    const otherPlayerDelete = await player2.delete(`/api/chat/${msgId}`);
    expect(otherPlayerDelete.status).toBe(403);

    const ownDelete = await player1.delete(`/api/chat/${msgId}`);
    expect(ownDelete.status).toBe(204);

    const row = await prisma.chatMessage.findUnique({ where: { id: msgId } });
    expect(row).toBeNull();
  });

  it("lets the world owner delete another user's message", async () => {
    const { agent: dm } = await signupAgent("chatdm3");
    const world = await dm.post("/api/worlds").send({ name: "Owner Delete World" });
    const worldId = world.body.id as string;
    const joinCode = await dm.post(`/api/worlds/${worldId}/join-code`);

    const { agent: player } = await signupAgent("chatplayer4");
    await player.post("/api/worlds/join").send({ code: joinCode.body.code });

    const msg = await player.post("/api/chat").send({ worldId, text: "inappropriate message" });
    const msgId = msg.body.id as string;

    const dmDelete = await dm.delete(`/api/chat/${msgId}`);
    expect(dmDelete.status).toBe(204);
  });

  it("403s a free account's history request with a machine-readable code", async () => {
    const { agent } = await signupAgent("chathistoryfree1");
    const world = await agent.post("/api/worlds").send({ name: "History World" });
    const worldId = world.body.id as string;
    const msg = await agent.post("/api/chat").send({ worldId, text: "only message" });

    const res = await agent.get(`/api/chat/history`).query({ worldId, before: msg.body.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("history_paid_only");
  });

  it("pages a paid account back through messages older than the given cursor", async () => {
    const { agent, userId } = await signupAgent("chathistorypaid1");
    await prisma.user.update({ where: { id: userId }, data: { tier: "paid" } });
    const world = await agent.post("/api/worlds").send({ name: "Paid History World" });
    const worldId = world.body.id as string;

    const first = await agent.post("/api/chat").send({ worldId, text: "oldest" });
    await agent.post("/api/chat").send({ worldId, text: "middle" });
    const third = await agent.post("/api/chat").send({ worldId, text: "newest" });

    // Paginating "before" the newest message should surface the older two,
    // most-recent-of-the-old first (descending — see chat.ts's /history note).
    const page = await agent.get(`/api/chat/history`).query({ worldId, before: third.body.id });
    expect(page.status).toBe(200);
    expect(page.body.map((m: { text: string }) => m.text)).toEqual(["middle", "oldest"]);

    // Paginating "before" the oldest message returns nothing further back.
    const exhausted = await agent.get(`/api/chat/history`).query({ worldId, before: first.body.id });
    expect(exhausted.body).toEqual([]);
  });
});

describe("chat roll posting", () => {
  it("persists a well-formed roll payload alongside the message", async () => {
    const { agent } = await signupAgent("chatroll1");
    const world = await agent.post("/api/worlds").send({ name: "Roll Chat World" });
    const worldId = world.body.id as string;

    const roll = { notation: "2d6+3", results: [4, 6], modifier: 3, total: 13, label: "Attack" };
    const res = await agent.post("/api/chat").send({ worldId, text: "🎲 2d6+3: 13", roll });
    expect(res.status).toBe(201);
    expect(res.body.roll).toEqual(roll);
  });

  it("drops a malformed roll payload but still posts the text", async () => {
    const { agent } = await signupAgent("chatroll2");
    const world = await agent.post("/api/worlds").send({ name: "Bad Roll Chat World" });
    const worldId = world.body.id as string;

    const res = await agent.post("/api/chat").send({ worldId, text: "not really a roll", roll: { notation: "d20" } });
    expect(res.status).toBe(201);
    expect(res.body.roll).toBeUndefined();
  });
});

describe("POST /chat/:id/react", () => {
  it("toggles the caller in and out of an emoji's reactor list", async () => {
    const { agent } = await signupAgent("chatreact1");
    const world = await agent.post("/api/worlds").send({ name: "Reaction World" });
    const worldId = world.body.id as string;
    const msg = await agent.post("/api/chat").send({ worldId, text: "nat 20!" });
    const msgId = msg.body.id as string;

    const react = await agent.post(`/api/chat/${msgId}/react`).send({ emoji: "🎲" });
    expect(react.status).toBe(200);
    expect(Object.keys(react.body.reactions)).toEqual(["🎲"]);

    const unreact = await agent.post(`/api/chat/${msgId}/react`).send({ emoji: "🎲" });
    expect(unreact.status).toBe(200);
    expect(unreact.body.reactions).toBeUndefined();
  });

  it("400s an unsupported emoji", async () => {
    const { agent } = await signupAgent("chatreact2");
    const world = await agent.post("/api/worlds").send({ name: "Reaction World 2" });
    const worldId = world.body.id as string;
    const msg = await agent.post("/api/chat").send({ worldId, text: "hi" });

    const react = await agent.post(`/api/chat/${msg.body.id}/react`).send({ emoji: "🍕" });
    expect(react.status).toBe(400);
  });

  it("403s reacting to a message in a world you can't access", async () => {
    const { agent: owner } = await signupAgent("chatreactowner1");
    const world = await owner.post("/api/worlds").send({ name: "Private Reaction World" });
    const msg = await owner.post("/api/chat").send({ worldId: world.body.id, text: "hi" });

    const { agent: outsider } = await signupAgent("chatreactoutsider1");
    const react = await outsider.post(`/api/chat/${msg.body.id}/react`).send({ emoji: "👍" });
    expect(react.status).toBe(403);
  });
});

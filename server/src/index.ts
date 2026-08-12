import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
// Express 4 doesn't forward a rejected promise from an async route handler
// to error-handling middleware on its own — it becomes an unhandled
// rejection that crashes the whole process (and every other in-flight
// request with it). This patches route/router handling so those rejections
// reach the catch-all error handler below instead. Must be imported before
// any router is registered.
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { generateRouter } from "./routes/generate.js";
import { generateItemRouter } from "./routes/generateItem.js";
import { generateLocationRouter } from "./routes/generateLocation.js";
import { generateQuestRouter } from "./routes/generateQuest.js";
import { generateFactionRouter } from "./routes/generateFaction.js";
import { generateEncounterTableRouter } from "./routes/generateEncounterTable.js";
import { generateAdventureRouter } from "./routes/generateAdventure.js";
import { generateDungeonRouter } from "./routes/generateDungeon.js";
import { generatePlayerCharacterRouter } from "./routes/generatePlayerCharacter.js";
import { generateShopRouter } from "./routes/generateShop.js";
import { generateRegionRouter } from "./routes/generateRegion.js";
import { generateSettlementRouter } from "./routes/generateSettlement.js";
import { charactersRouter } from "./routes/characters.js";
import { itemsRouter } from "./routes/items.js";
import { locationsRouter } from "./routes/locations.js";
import { regionsRouter } from "./routes/regions.js";
import { settlementsRouter } from "./routes/settlements.js";
import { questsRouter } from "./routes/quests.js";
import { factionsRouter } from "./routes/factions.js";
import { encounterTablesRouter } from "./routes/encounterTables.js";
import { sessionNotesRouter } from "./routes/sessionNotes.js";
import { adventuresRouter } from "./routes/adventures.js";
import { playerCharactersRouter } from "./routes/playerCharacters.js";
import { rollLogRouter } from "./routes/rollLog.js";
import { codexNotesRouter } from "./routes/codexNotes.js";
import { ledgerRouter } from "./routes/ledger.js";
import { downtimeRouter } from "./routes/downtime.js";
import { encountersRouter } from "./routes/encounters.js";
import { zoneMapTemplatesRouter } from "./routes/zoneMapTemplates.js";
import { dungeonsRouter } from "./routes/dungeons.js";
import { shopsRouter } from "./routes/shops.js";
import { activityRouter } from "./routes/activity.js";
import { worldsRouter } from "./routes/worlds.js";
import { worldLiveRouter } from "./routes/worldLive.js";
import { referenceRouter } from "./routes/reference.js";
import { compendiumRouter } from "./routes/compendium.js";
import { searchRouter } from "./routes/search.js";
import { linksRouter } from "./routes/links.js";
import { backupRouter } from "./routes/backup.js";
import { publicGalleryRouter } from "./routes/publicGallery.js";
import { vttExportRouter } from "./routes/vttExport.js";
import { billingRouter, billingWebhookHandler } from "./routes/billing.js";
import { FREE_TIER_GENERATE_LIMIT, PAID_TIER_GENERATE_LIMIT } from "./billingLimits.js";
import { prisma } from "./db.js";

// Belt-and-suspenders: express-async-errors covers rejections inside route
// handlers, but anything that rejects outside the request/response cycle
// (a stray non-awaited promise, startup code, etc.) would otherwise still
// crash the whole process per Node's default behavior. Log instead — for
// a small single-instance app, going down entirely on any one hiccup is a
// worse failure mode than staying up with a logged error.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

const app = express();
app.use(cors());
app.use(cookieParser());

// Stripe signs the raw request body and calls this endpoint directly (not
// as a logged-in browser), so it must sit before express.json() rewrites
// the body and before the requireAuth gate below.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);

app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

// Everything below requires a signed-in user.
app.use("/api", requireAuth);

// Backstop for every authenticated route that isn't already behind a
// stricter, purpose-specific limiter (currently just the generate routes
// below) — a compromised or careless account shouldn't be able to hammer
// CRUD routes or, worse, /api/billing/checkout (which calls Stripe on every
// request) without limit. Keyed by user, not IP, since every request here
// is already authenticated.
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId!,
  message: { error: "You're making requests a bit fast — please wait a moment and try again." },
});
app.use("/api", generalApiLimiter);

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: async (req) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
    return user?.tier === "paid" ? PAID_TIER_GENERATE_LIMIT : FREE_TIER_GENERATE_LIMIT;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're generating a bit fast — please wait a moment and try again." },
});

app.use("/api/generate", generateLimiter, generateRouter);
app.use("/api/generate-item", generateLimiter, generateItemRouter);
app.use("/api/generate-location", generateLimiter, generateLocationRouter);
app.use("/api/generate-quest", generateLimiter, generateQuestRouter);
app.use("/api/generate-faction", generateLimiter, generateFactionRouter);
app.use("/api/generate-encounter-table", generateLimiter, generateEncounterTableRouter);
app.use("/api/generate-adventure", generateLimiter, generateAdventureRouter);
app.use("/api/generate-dungeon", generateLimiter, generateDungeonRouter);
app.use("/api/generate-player-character", generateLimiter, generatePlayerCharacterRouter);
app.use("/api/generate-shop", generateLimiter, generateShopRouter);
app.use("/api/generate-region", generateLimiter, generateRegionRouter);
app.use("/api/generate-settlement", generateLimiter, generateSettlementRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/regions", regionsRouter);
app.use("/api/settlements", settlementsRouter);
app.use("/api/quests", questsRouter);
app.use("/api/factions", factionsRouter);
app.use("/api/encounter-tables", encounterTablesRouter);
app.use("/api/session-notes", sessionNotesRouter);
app.use("/api/adventures", adventuresRouter);
app.use("/api/player-characters", playerCharactersRouter);
app.use("/api/roll-log", rollLogRouter);
app.use("/api/codex-notes", codexNotesRouter);
app.use("/api/ledger", ledgerRouter);
app.use("/api/downtime", downtimeRouter);
app.use("/api/encounters", encountersRouter);
app.use("/api/zone-map-templates", zoneMapTemplatesRouter);
app.use("/api/dungeons", dungeonsRouter);
app.use("/api/shops", shopsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/worlds", worldsRouter);
app.use("/api/worlds", worldLiveRouter);
app.use("/api/reference", referenceRouter);
app.use("/api/compendium", compendiumRouter);
app.use("/api/search", searchRouter);
app.use("/api/links", linksRouter);
app.use("/api/backup", backupRouter);
app.use("/api/public", publicGalleryRouter);
app.use("/api", vttExportRouter);
app.use("/api/billing", billingRouter);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Catch-all: any error thrown or rejected inside a route handler (now
// forwarded here by express-async-errors above) lands as a clean JSON 500
// for that one request, instead of crashing the process for everyone.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our end — please try again." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Spark API listening on http://localhost:${port}`);
});

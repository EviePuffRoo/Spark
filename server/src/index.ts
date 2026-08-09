import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
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
import { charactersRouter } from "./routes/characters.js";
import { itemsRouter } from "./routes/items.js";
import { locationsRouter } from "./routes/locations.js";
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
import { referenceRouter } from "./routes/reference.js";
import { searchRouter } from "./routes/search.js";
import { linksRouter } from "./routes/links.js";
import { backupRouter } from "./routes/backup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

// Everything below requires a signed-in user.
app.use("/api", requireAuth);

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
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
app.use("/api/characters", charactersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/locations", locationsRouter);
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
app.use("/api/reference", referenceRouter);
app.use("/api/search", searchRouter);
app.use("/api/links", linksRouter);
app.use("/api/backup", backupRouter);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Spark API listening on http://localhost:${port}`);
});

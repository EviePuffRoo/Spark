import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { generateRouter } from "./routes/generate.js";
import { generateItemRouter } from "./routes/generateItem.js";
import { generateLocationRouter } from "./routes/generateLocation.js";
import { generateQuestRouter } from "./routes/generateQuest.js";
import { generateFactionRouter } from "./routes/generateFaction.js";
import { generateEncounterTableRouter } from "./routes/generateEncounterTable.js";
import { charactersRouter } from "./routes/characters.js";
import { itemsRouter } from "./routes/items.js";
import { locationsRouter } from "./routes/locations.js";
import { questsRouter } from "./routes/quests.js";
import { factionsRouter } from "./routes/factions.js";
import { encounterTablesRouter } from "./routes/encounterTables.js";
import { sessionNotesRouter } from "./routes/sessionNotes.js";
import { worldsRouter } from "./routes/worlds.js";
import { referenceRouter } from "./routes/reference.js";
import { searchRouter } from "./routes/search.js";
import { linksRouter } from "./routes/links.js";
import { backupRouter } from "./routes/backup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/generate", generateRouter);
app.use("/api/generate-item", generateItemRouter);
app.use("/api/generate-location", generateLocationRouter);
app.use("/api/generate-quest", generateQuestRouter);
app.use("/api/generate-faction", generateFactionRouter);
app.use("/api/generate-encounter-table", generateEncounterTableRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/quests", questsRouter);
app.use("/api/factions", factionsRouter);
app.use("/api/encounter-tables", encounterTablesRouter);
app.use("/api/session-notes", sessionNotesRouter);
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

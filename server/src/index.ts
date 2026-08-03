import express from "express";
import cors from "cors";
import { generateRouter } from "./routes/generate.js";
import { charactersRouter } from "./routes/characters.js";
import { worldsRouter } from "./routes/worlds.js";
import { referenceRouter } from "./routes/reference.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/generate", generateRouter);
app.use("/api/characters", charactersRouter);
app.use("/api/worlds", worldsRouter);
app.use("/api/reference", referenceRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Spark API listening on http://localhost:${port}`);
});

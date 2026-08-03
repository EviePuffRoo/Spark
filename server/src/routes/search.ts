import { Router } from "express";
import { ENTITY_TYPES } from "@spark/shared";
import type { SearchResult } from "@spark/shared";
import { getAdapter, isEntityType, searchEntities } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const searchRouter = Router();

searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const typeFilter = req.query.type;

  if (!q) return res.json({ query: q, results: [] });

  const types = typeof typeFilter === "string" && isEntityType(typeFilter)
    ? [typeFilter]
    : ENTITY_TYPES.map((t) => t.type);

  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const results: SearchResult[] = [];
  for (const type of types) {
    const adapter = getAdapter(type);
    if (!adapter) continue;
    const rows = await searchEntities(type, q, req.userId!, memberWorldIds);
    for (const row of rows) {
      results.push({
        type,
        id: row.id,
        name: adapter.getName(row),
        meta: adapter.getMeta(row),
        worldId: row.worldId ?? null,
      });
    }
  }

  res.json({ query: q, results });
});

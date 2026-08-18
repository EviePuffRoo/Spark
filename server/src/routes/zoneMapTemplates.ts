import { Router } from "express";
import { prisma } from "../db.js";
import { toZoneMapTemplateDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";
import { coerceZone } from "./encounters.js";
import type { EncounterZone } from "@spark/shared";

export const zoneMapTemplatesRouter = Router();

zoneMapTemplatesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.zoneMapTemplate.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toZoneMapTemplateDTO));
});

zoneMapTemplatesRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.zoneMapTemplate.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Zone map template not found" });
  res.json(toZoneMapTemplateDTO(row));
});

zoneMapTemplatesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, zones, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !Array.isArray(zones) || zones.length === 0) {
    return res.status(400).json({ error: "Missing required zone map template fields" });
  }
  const coercedZones = zones.map(coerceZone).filter((z: EncounterZone | null): z is EncounterZone => z !== null);

  const row = await prisma.zoneMapTemplate.create({
    data: {
      name,
      zones: JSON.stringify(coercedZones),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toZoneMapTemplateDTO(row));
});

zoneMapTemplatesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("zones" in body) {
    const coercedZones = Array.isArray(body.zones) ? body.zones.map(coerceZone).filter((z: EncounterZone | null): z is EncounterZone => z !== null) : [];
    data.zones = JSON.stringify(coercedZones);
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.zoneMapTemplate.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Zone map template not found" });
  const row = await prisma.zoneMapTemplate.findUnique({ where: { id: req.params.id } });
  res.json(toZoneMapTemplateDTO(row!));
});

zoneMapTemplatesRouter.delete("/:id", async (req, res) => {
  const result = await prisma.zoneMapTemplate.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Zone map template not found" });
  await deleteLinksForEntity("zoneMapTemplate", req.params.id, req.userId!);
  res.status(204).end();
});

import type { Character as CharacterRow } from "@prisma/client";
import type { Character } from "@spark/shared";

export function toCharacterDTO(row: CharacterRow): Character {
  return {
    id: row.id,
    kind: row.kind as Character["kind"],
    name: row.name,
    race: row.race ?? undefined,
    background: row.background ?? undefined,
    alignment: row.alignment,
    templateId: row.templateId,
    templateName: row.templateName,
    statBlock: JSON.parse(row.statBlock),
    backstory: JSON.parse(row.backstory),
    worldId: row.worldId,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

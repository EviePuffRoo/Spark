import type { Character as CharacterRow, Item as ItemRow } from "@prisma/client";
import type { Character, Item } from "@spark/shared";

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

export function toItemDTO(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    itemType: row.itemType,
    category: row.category,
    rarity: row.rarity,
    description: row.description,
    property: row.property,
    history: row.history,
    worldId: row.worldId,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

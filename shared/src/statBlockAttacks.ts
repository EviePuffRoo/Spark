import type { AbilityKey, StatBlockAction } from "./types.js";

export interface ParsedSavingThrow {
  ability: AbilityKey;
  dc: number;
}

export interface ParsedAttack {
  name: string;
  toHitBonus: number | null;
  damageDice: string | null;
  damageType: string | null;
  savingThrow: ParsedSavingThrow | null;
}

const ABILITY_WORDS: Record<string, AbilityKey> = {
  str: "str", strength: "str",
  dex: "dex", dexterity: "dex",
  con: "con", constitution: "con",
  int: "int", intelligence: "int",
  wis: "wis", wisdom: "wis",
  cha: "cha", charisma: "cha",
};

const TO_HIT_RE = /\bAttack:\s*([+-]\d+)\s*to hit\b/i;
const DAMAGE_RE = /\bHit:\s*\d+\s*\(([^)]+)\)\s*([a-z]+)\s+damage/i;
const SAVE_RE = /\bDC\s*(\d+)\s+(\w+)\s+saving throw\b/i;

// D&D 5e stat blocks follow a fixed sentence template ("Melee Weapon
// Attack: +4 to hit, ... Hit: 7 (2d4+2) piercing damage. ... DC 11
// Strength saving throw ..."), and every generated NPC/monster action
// description in this app is drawn verbatim from that convention (see
// data/monsterTemplates.ts and data/npcTemplates.ts) rather than being
// freely authored — so a handful of anchored regexes reliably extract the
// mechanical bits without needing a structured schema change to every
// stat block. Actions with neither an attack roll nor a saving throw
// (Multiattack, pure flavor traits) are skipped rather than returned as
// empty entries, since there's nothing here for the Attack panel to roll.
export function parseStatBlockAttacks(actions: StatBlockAction[]): ParsedAttack[] {
  const parsed: ParsedAttack[] = [];
  for (const action of actions) {
    const toHitMatch = action.description.match(TO_HIT_RE);
    const damageMatch = action.description.match(DAMAGE_RE);
    const saveMatch = action.description.match(SAVE_RE);
    const ability = saveMatch ? ABILITY_WORDS[saveMatch[2].toLowerCase()] : undefined;
    if (!toHitMatch && !(saveMatch && ability)) continue;
    parsed.push({
      name: action.name,
      toHitBonus: toHitMatch ? Number(toHitMatch[1]) : null,
      damageDice: damageMatch ? damageMatch[1].trim() : null,
      damageType: damageMatch ? damageMatch[2].toLowerCase() : null,
      savingThrow: saveMatch && ability ? { ability, dc: Number(saveMatch[1]) } : null,
    });
  }
  return parsed;
}

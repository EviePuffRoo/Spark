import type { AbilityKey, PlayerCharacterInput } from "./types.js";

export interface CharacterImportResult {
  draft: PlayerCharacterInput;
  matchedFields: string[];
}

const ABILITY_LABELS: [AbilityKey, string[]][] = [
  ["str", ["strength", "str"]],
  ["dex", ["dexterity", "dex"]],
  ["con", ["constitution", "con"]],
  ["int", ["intelligence", "int"]],
  ["wis", ["wisdom", "wis"]],
  ["cha", ["charisma", "cha"]],
];

function firstNumber(text: string): number | null {
  const m = text.match(/-?\d{1,3}/);
  return m ? Number(m[0]) : null;
}

// Looks for a line that starts with one of `labels` (word-boundaried, so
// "str" doesn't match "Strongbox") followed by an optional colon and a
// value. Stat blocks sometimes put the value on the next line instead of
// the same one (card-style layouts), so an empty same-line match falls
// back to the line right after it.
function findLabeled(lines: string[], labels: string[]): string | null {
  const pattern = new RegExp(`^(?:${labels.join("|")})\\b\\s*:?\\s*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(pattern);
    if (!m) continue;
    if (m[1].trim()) return m[1].trim();
    const next = lines[i + 1]?.trim();
    return next || null;
  }
  return null;
}

// Deterministic, no AI: pulls recognizable "Label: value" or "Label\nvalue"
// pairs out of a pasted character sheet and pre-fills a draft for review in
// the editor. Anything it can't confidently find is left at a sensible
// default rather than guessed, since the editor that follows is where the
// player actually reviews and corrects the result.
export function parseCharacterText(text: string): CharacterImportResult {
  const lines = text.split(/\r?\n/);
  const draft: PlayerCharacterInput = {
    name: "",
    className: "",
    level: 1,
    race: "",
    armorClass: 10,
    maxHp: 10,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  };
  const matched: string[] = [];

  const name = findLabeled(lines, ["name", "character name"]);
  if (name) {
    draft.name = name;
    matched.push("name");
  }

  const classLevel = findLabeled(lines, ["class\\s*(?:&|and)?\\s*level"]);
  if (classLevel) {
    const simple = classLevel.match(/^([A-Za-z][A-Za-z ]*?)\s+(\d{1,2})$/);
    if (simple) {
      draft.className = simple[1].trim();
      draft.level = Number(simple[2]);
      matched.push("className", "level");
    } else {
      draft.className = classLevel;
      matched.push("className");
    }
  } else {
    const className = findLabeled(lines, ["class"]);
    if (className) {
      draft.className = className;
      matched.push("className");
    }
    const level = findLabeled(lines, ["level"]);
    const levelNum = level ? firstNumber(level) : null;
    if (levelNum !== null) {
      draft.level = levelNum;
      matched.push("level");
    }
  }

  const race = findLabeled(lines, ["race", "species"]);
  if (race) {
    draft.race = race;
    matched.push("race");
  }

  const ac = findLabeled(lines, ["armor class", "ac"]);
  const acNum = ac ? firstNumber(ac) : null;
  if (acNum !== null) {
    draft.armorClass = acNum;
    matched.push("armorClass");
  }

  const hp = findLabeled(lines, ["hit point maximum", "hit points", "max(?:imum)? hp", "hp"]);
  const hpNum = hp ? firstNumber(hp) : null;
  if (hpNum !== null) {
    draft.maxHp = hpNum;
    matched.push("maxHp");
  }

  let anyAbility = false;
  for (const [key, labels] of ABILITY_LABELS) {
    const value = findLabeled(lines, labels);
    const num = value ? firstNumber(value) : null;
    if (num !== null) {
      draft.abilityScores[key] = num;
      anyAbility = true;
    }
  }
  if (anyAbility) matched.push("abilityScores");

  const playerName = findLabeled(lines, ["player name", "player"]);
  if (playerName) {
    draft.playerName = playerName;
    matched.push("playerName");
  }

  return { draft, matchedFields: matched };
}

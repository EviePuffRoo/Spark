export type SizeCategory = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

// Footprint width/height in tiles for a creature of this size, per the 5e
// SRD's space-in-feet-by-size table (5 ft per tile, so Large=2 tiles/10ft,
// Huge=3/15ft, Gargantuan=4/20ft — the SRD's actual Gargantuan minimum).
export const SIZE_FOOTPRINT: Record<SizeCategory, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

const SIZE_WORDS: Record<string, SizeCategory> = {
  tiny: "tiny", small: "small", medium: "medium", large: "large", huge: "huge", gargantuan: "gargantuan",
};

// StatBlock.size is free text ("Medium", "Large") rather than a typed enum
// — every generated NPC/monster in this app already uses one of the SRD's
// six words verbatim (see data/monsterTemplates.ts, data/npcTemplates.ts),
// so a direct word match is enough; anything unrecognized (or missing, for
// player characters — this app doesn't track PC size at all) defaults to
// Medium, the by-far most common case.
export function parseSizeCategory(sizeText: string | undefined): SizeCategory {
  const word = (sizeText ?? "").trim().toLowerCase();
  return SIZE_WORDS[word] ?? "medium";
}

const SPEED_RE = /(\d+)\s*ft/;

// StatBlock.speed is also free text ("30 ft.", "25 ft., fly 60 ft.") — the
// first number is always the base walking speed by the same SRD sentence
// convention parseStatBlockAttacks relies on for attacks. Missing or
// unparseable text defaults to 30 ft, the standard baseline speed.
export function parseSpeedFeet(speedText: string | undefined): number {
  const match = SPEED_RE.exec(speedText ?? "");
  return match ? Number(match[1]) : 30;
}

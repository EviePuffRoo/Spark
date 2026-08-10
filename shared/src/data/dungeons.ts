export interface DungeonHazardDef {
  label: string;
  damageRange: [number, number];
}

export const DUNGEON_HAZARDS: DungeonHazardDef[] = [
  { label: "Collapsing floor", damageRange: [2, 8] },
  { label: "Poison dart trap", damageRange: [3, 10] },
  { label: "Swinging blade", damageRange: [4, 12] },
  { label: "Pressure plate spikes", damageRange: [3, 9] },
  { label: "Crumbling ceiling", damageRange: [4, 14] },
  { label: "Flooded passage", damageRange: [1, 6] },
  { label: "Noxious gas vent", damageRange: [2, 7] },
  { label: "Rolling boulder", damageRange: [5, 15] },
  { label: "Rune-triggered flame jet", damageRange: [4, 11] },
  { label: "Rotted floorboards", damageRange: [1, 5] },
  { label: "Falling portcullis", damageRange: [3, 10] },
  { label: "Unstable scaffolding", damageRange: [2, 9] },
];

export const DUNGEON_EXIT_LABELS: string[] = [
  "passage", "corridor", "stairwell", "tunnel", "archway", "narrow crawlspace",
];

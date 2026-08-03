export interface RaceDef {
  id: string;
  name: string;
  size: "Small" | "Medium";
  speed: number;
  darkvision: boolean;
  traits: string[];
}

export const RACES: RaceDef[] = [
  { id: "human", name: "Human", size: "Medium", speed: 30, darkvision: false, traits: [] },
  { id: "hill-dwarf", name: "Hill Dwarf", size: "Medium", speed: 25, darkvision: true, traits: ["Dwarven Resilience (advantage vs. poison, resistance to poison damage)"] },
  { id: "high-elf", name: "High Elf", size: "Medium", speed: 30, darkvision: true, traits: ["Fey Ancestry (advantage vs. being charmed, immune to magical sleep)"] },
  { id: "wood-elf", name: "Wood Elf", size: "Medium", speed: 35, darkvision: true, traits: ["Fey Ancestry", "Mask of the Wild (can hide in light natural cover)"] },
  { id: "lightfoot-halfling", name: "Lightfoot Halfling", size: "Small", speed: 25, darkvision: false, traits: ["Lucky (reroll natural 1s)", "Naturally Stealthy"] },
  { id: "dragonborn", name: "Dragonborn", size: "Medium", speed: 30, darkvision: false, traits: ["Breath Weapon", "Damage Resistance (draconic ancestry)"] },
  { id: "forest-gnome", name: "Forest Gnome", size: "Small", speed: 25, darkvision: true, traits: ["Gnome Cunning (advantage on INT/WIS/CHA saves vs. magic)"] },
  { id: "half-elf", name: "Half-Elf", size: "Medium", speed: 30, darkvision: true, traits: ["Fey Ancestry"] },
  { id: "half-orc", name: "Half-Orc", size: "Medium", speed: 30, darkvision: true, traits: ["Relentless Endurance", "Savage Attacks"] },
  { id: "tiefling", name: "Tiefling", size: "Medium", speed: 30, darkvision: true, traits: ["Hellish Resistance (fire)", "Infernal Legacy (thaumaturgy cantrip)"] },
];

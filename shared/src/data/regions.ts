export interface TerrainCategoryDef {
  id: string;
  name: string;
}

export const TERRAIN_CATEGORIES: TerrainCategoryDef[] = [
  { id: "forest", name: "Forest" },
  { id: "mountains", name: "Mountains" },
  { id: "coastal", name: "Coastal" },
  { id: "swamp", name: "Swamp" },
  { id: "plains", name: "Plains" },
  { id: "desert", name: "Desert" },
  { id: "tundra", name: "Tundra" },
  { id: "hills", name: "Hills" },
  { id: "underdark", name: "Underdark" },
];

export const DANGER_LEVELS: string[] = [
  "Peaceful", "Settled", "Watchful", "Contested", "Dangerous", "Deadly",
];

export const REGION_NAME_ADJECTIVES: string[] = [
  "Weeping", "Gilded", "Shattered", "Silent", "Ashen", "Wandering", "Forsaken",
  "Emerald", "Frostbound", "Sunlit", "Withered", "Boundless", "Hollow",
];

export const REGION_NAME_NOUNS: string[] = [
  "Reach", "Expanse", "Marches", "Wilds", "Vale", "Barrens", "Span", "Frontier",
  "Hollows", "Crown", "Deep", "Sprawl",
];

export const REGION_DESCRIPTIONS: string[] = [
  "A sprawling territory where {feature}, and travelers rarely pass through without a good reason.",
  "Best known for {feature}, this region draws both fortune-seekers and those fleeing something worse.",
  "Old maps mark this land with warnings, mostly because {feature}.",
  "Settlers who've carved out a living here will tell you {feature} — and that it's the least of their worries.",
  "The region is defined as much by its people as its land, though {feature}.",
  "Few maps agree on this territory's exact borders, in part because {feature}.",
  "Caravans favor the longer route around this region, since {feature}.",
  "Local legend holds that {feature}, though no two tellings agree on the details.",
];

export const REGION_FEATURES: string[] = [
  "the weather turns without warning",
  "old ruins dot the landscape, unclaimed and unexplained",
  "a single road cuts through, watched closely by whoever controls it",
  "the wildlife has grown unusually bold",
  "border disputes flare up every few seasons",
  "strange lights are reported after dark",
  "the soil holds more history than most people are comfortable with",
  "trade routes converge here, for better and worse",
  "the land itself seems to resist being mapped accurately",
  "a scattering of isolated communities keep mostly to themselves",
  "something ancient is rumored to sleep beneath it",
  "the terrain shifts dramatically within a day's travel",
];

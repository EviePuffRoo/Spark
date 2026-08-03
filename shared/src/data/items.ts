export interface ItemCategoryDef {
  id: string;
  name: string;
}

export const ITEM_CATEGORIES: ItemCategoryDef[] = [
  { id: "weapon", name: "Weapon" },
  { id: "armor", name: "Armor & Wearables" },
  { id: "wondrous", name: "Wondrous Item" },
  { id: "potion", name: "Potion & Consumable" },
  { id: "trinket", name: "Trinket & Curio" },
  { id: "tool", name: "Tool & Kit" },
  { id: "instrument", name: "Instrument" },
];

export const ITEM_TYPES_BY_CATEGORY: Record<string, string[]> = {
  weapon: ["Dagger", "Shortsword", "Longsword", "Handaxe", "Warhammer", "Spear", "Rapier", "Shortbow", "Sling", "Mace", "Quarterstaff"],
  armor: ["Cloak", "Leather Jerkin", "Chainmail Shirt", "Buckler", "Helm", "Gauntlets", "Boots", "Bracers", "Sash", "Traveling Coat"],
  wondrous: ["Ring", "Amulet", "Circlet", "Brooch", "Pendant", "Mask", "Lantern", "Mirror", "Music Box", "Compass", "Hourglass", "Key", "Locket"],
  potion: ["Vial of Shimmering Liquid", "Sealed Potion Bottle", "Tin of Salve", "Waxed Tonic Flask", "Corked Elixir", "Paper Sachet of Powder"],
  trinket: ["Old Coin", "Glass Marble", "Deck of Cards", "Set of Dice", "Carved Pipe", "Brass Quill", "Pocket Watch", "Snuffbox", "Tin Whistle", "Small Bell", "Thimble"],
  tool: ["Lockpick Set", "Stonemason's Chisel", "Collapsible Fishing Rod", "Brass Compass", "Whetstone", "Tinderbox", "Folding Spyglass", "Surveyor's Kit"],
  instrument: ["Lute", "Wooden Flute", "Hand Drum", "Fiddle", "Small Harp", "Hunting Horn"],
};

export const ITEM_ADJECTIVES: string[] = [
  "tarnished silver", "weathered oak", "moth-eaten velvet", "sea-glass green", "storm-forged iron",
  "moonlit pearl", "soot-stained", "ivy-etched", "hand-carved bone", "cracked porcelain",
  "faded crimson", "frost-kissed", "sun-bleached", "rune-scratched", "salt-crusted",
  "dust-covered", "quietly gleaming", "unnervingly warm", "oddly heavy", "impossibly light",
];

export const ITEM_PROPERTIES: string[] = [
  "Hums faintly whenever danger is near.",
  "Never quite dries, no matter how long it sits in the sun.",
  "Whispers the last words spoken near it, if held to the ear at midnight.",
  "Grows faintly warm in the presence of its true owner's blood kin.",
  "Once per day, it can be commanded to shed torchlight for one minute.",
  "Small animals are inexplicably calm around it.",
  "Leaves no footprints when its bearer walks softly.",
  "Tastes faintly of a memory the taster has never had.",
  "Its shadow doesn't quite match its shape in dim light.",
  "Grants advantage on the next Persuasion check made while telling the truth, once per long rest.",
  "Rings like a distant bell when it strikes something hollow.",
  "Any ink applied to it never fades, no matter how old the page.",
  "Chimes softly at the first sign of rain, an hour before the clouds arrive.",
  "Feels lighter in honest hands and heavier in a thief's.",
  "Its flame, once lit, never gutters in the wind.",
  "Reflects the viewer as they looked exactly one year ago.",
  "Keeps perfect time, but only for its bonded owner.",
  "Draws small, harmless sparks when struck against stone.",
  "Once per day, grants advantage on a saving throw against being frightened.",
  "Smells permanently of the place it was made, however far it travels.",
];

export const ITEM_HISTORIES: string[] = [
  "Said to have belonged to a hedge wizard who vanished mid-spell.",
  "Recovered from a shipwreck no living sailor remembers sinking.",
  "Passed down through five generations of the same modest family.",
  "Won in a wager whose stakes nobody now recalls.",
  "Found sealed behind a false wall in a condemned tavern.",
  "Carried by a soldier who deserted the night before the battle.",
  "Left behind by a traveling performer who never returned for it.",
  "Pulled from the ashes of a temple that burned in a single night.",
  "Traded to a farmer for a debt no one wrote down.",
  "Discovered stitched into the lining of a dead courier's coat.",
  "Once displayed in a noble's collection, quietly stolen and never missed.",
  "Buried with someone who, when the grave was later opened, was gone.",
  "Given as a wedding gift by a groom who never showed.",
  "Forged by an apprentice the night before their master disappeared.",
  "Found in the nest of a magpie with an unusual eye for treasure.",
];

export const ITEM_RARITY_TIERS: string[] = [
  "Everyday Curiosity",
  "Minor Wonder",
  "Uncommon Treasure",
  "Rare Relic",
  "Legendary Heirloom",
];

export const ITEM_EPITHETS: string[] = [
  "Nightsong", "Emberkeep", "Widow's Grace", "Farwatcher", "Last Ember", "Quiet Oath",
  "Hollowmark", "Loomwhisper", "Foxglove", "the Long Wait", "Cinderfall", "Old Kettlebright",
  "Thistledown", "the Second Chance", "Graywater",
];

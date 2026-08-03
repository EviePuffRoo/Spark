export interface LocationCategoryDef {
  id: string;
  name: string;
}

export const LOCATION_CATEGORIES: LocationCategoryDef[] = [
  { id: "settlement", name: "Settlement" },
  { id: "wilderness", name: "Wilderness" },
  { id: "dungeon", name: "Dungeon & Ruin" },
  { id: "landmark", name: "Landmark" },
];

export const LOCATION_TYPES_BY_CATEGORY: Record<string, string[]> = {
  settlement: ["Tavern", "Inn", "Temple", "Marketplace", "Blacksmith's Forge", "Apothecary", "Manor House", "Prison", "Library", "Bathhouse"],
  wilderness: ["Hidden Grove", "Campsite", "Standing Stones", "Ferry Crossing", "Hunting Lodge", "Abandoned Farmstead"],
  dungeon: ["Ruined Keep", "Cave Entrance", "Abandoned Mine", "Sewer Junction", "Collapsed Temple", "Forgotten Crypt"],
  landmark: ["Lighthouse", "Windmill", "Watchtower", "Old Stone Bridge", "Graveyard", "Bell Tower"],
};

export const LOCATION_DESCRIPTORS: string[] = [
  "fog-wrapped", "sun-bleached", "ivy-choked", "lantern-lit", "wind-battered", "moss-covered",
  "smoke-stained", "half-flooded", "eerily quiet", "surprisingly cheerful", "crumbling",
  "freshly painted", "overgrown", "salt-worn", "candlelit",
];

export const LOCATION_NAME_ADJECTIVES: string[] = [
  "Wandering", "Hollow", "Silver", "Drowsy", "Broken", "Gilded", "Weeping", "Laughing",
  "Quiet", "Restless", "Painted", "Forgotten", "Salty", "Whispering", "Crooked",
];

export const LOCATION_NAME_NOUNS: string[] = [
  "Lantern", "Bell", "Anchor", "Raven", "Oak", "Stag", "Kettle", "Compass", "Candle",
  "Wheel", "Crown", "Well", "Hearth", "Fox", "Tide",
];

export const LOCATION_FEATURES: string[] = [
  "A mural on the far wall has been crudely painted over, but the old lines still show through.",
  "The floorboards creak in a pattern that almost sounds like a tune.",
  "A single chair at the best table is always kept empty.",
  "Bundles of dried herbs hang from every beam, some clearly decades old.",
  "A cracked bell sits in the corner, rung only on the anniversary of some forgotten event.",
  "The walls are lined with the handprints of everyone who's ever stayed the night.",
  "A well in the center never quite runs dry, even in drought.",
  "Every door in the place is a slightly different color, as if salvaged from elsewhere.",
  "Cats seem to gather here in numbers no one can explain.",
  "A faded flag hangs from the highest point, from a nation that no longer exists.",
  "One room is always locked, and whoever's in charge changes the subject when asked why.",
  "Candle wax has pooled into strange shapes on every windowsill.",
  "The nearest water source tastes faintly of copper.",
  "Every clock in the building reads a different time.",
  "A carved inscription over the entrance has been worn smooth by centuries of hands touching it for luck.",
];

export const LOCATION_KEEPERS: string[] = [
  "Run by a retired adventurer who still flinches at loud noises.",
  "Watched over by an elderly caretaker who claims to remember a war three generations gone.",
  "Home to a family that's lived here longer than anyone can verify.",
  "Currently abandoned, though someone has clearly been keeping it swept.",
  "Tended by a quiet figure who never seems to sleep.",
  "Overseen by a guild representative who's clearly out of their depth.",
  "Occupied by squatters who've made themselves surprisingly comfortable.",
  "Managed by twins who finish each other's sentences and prices.",
  "Guarded, loosely, by a dog no one claims to own but everyone feeds.",
  "Left in the care of an apprentice whose master hasn't been seen in weeks.",
];

export const LOCATION_RUMORS: string[] = [
  "Locals whisper that something valuable was hidden here during the last war and never recovered.",
  "Travelers report strange lights here on moonless nights.",
  "A merchant went missing after visiting, and no one wants to say more.",
  "The previous owner left in a hurry and never came back for their belongings.",
  "Someone has been leaving fresh flowers here every week, but no one admits to it.",
  "There's a persistent rumor of a tunnel beneath the place that no one has found.",
  "A local noble has quietly expressed interest in buying the place, for reasons unknown.",
  "Every so often, something goes missing and turns up again exactly a year later.",
  "A traveling scholar once spent a month here researching something they never named.",
  "The building survived a disaster that destroyed everything around it, and no one can explain why.",
  "A faction is rumored to use this place as a meeting point, though no one agrees on which one.",
  "Local children dare each other to spend a night here.",
  "An old debt is said to still be owed to whoever built this place.",
  "A locked chest was found here decades ago and, as far as anyone knows, was never opened.",
  "Something about this place makes animals refuse to enter.",
];

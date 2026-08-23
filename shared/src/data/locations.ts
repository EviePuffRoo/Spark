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
  settlement: ["Tavern", "Inn", "Temple", "Marketplace", "Blacksmith's Forge", "Apothecary", "Manor House", "Prison", "Library", "Bathhouse", "Cobbler's Shop", "Scriptorium", "Physician's House", "Weaver's Hall"],
  wilderness: ["Hidden Grove", "Campsite", "Standing Stones", "Ferry Crossing", "Hunting Lodge", "Abandoned Farmstead", "Overgrown Orchard", "Sunken Bog", "Windswept Bluff", "Forgotten Shrine", "Hermit's Clearing", "Old Quarry", "Frozen Waterfall", "Thorned Hedge Maze", "Tidal Cave", "Drifting Fen"],
  dungeon: ["Ruined Keep", "Cave Entrance", "Abandoned Mine", "Sewer Junction", "Collapsed Temple", "Forgotten Crypt", "Sunken Cistern", "Old Catacombs", "Buried Vault", "Cracked Cellar", "Overrun Barracks", "Flooded Tunnel", "Drowned Undercroft", "Cracked Reliquary", "Forsaken Garrison", "Root-Choked Warren"],
  landmark: ["Lighthouse", "Windmill", "Watchtower", "Old Stone Bridge", "Graveyard", "Bell Tower", "Ancient Obelisk", "Ruined Aqueduct", "Sundial Plaza", "Toppled Statue", "Weathered Monument", "Abandoned Mill", "Sunken Bell Garden", "Old Toll Gate", "Crumbling Signal Fire", "Fossilized Grove"],
};

export const LOCATION_DESCRIPTORS: string[] = [
  "fog-wrapped", "sun-bleached", "ivy-choked", "lantern-lit", "wind-battered", "moss-covered",
  "smoke-stained", "half-flooded", "eerily quiet", "surprisingly cheerful", "crumbling",
  "freshly painted", "overgrown", "salt-worn", "candlelit",
  "rain-slicked", "amber-lit", "threadbare", "wave-worn", "dust-veiled", "vine-strangled",
];

export const LOCATION_NAME_ADJECTIVES: string[] = [
  "Wandering", "Hollow", "Silver", "Drowsy", "Broken", "Gilded", "Weeping", "Laughing",
  "Quiet", "Restless", "Painted", "Forgotten", "Salty", "Whispering", "Crooked",
  "Dappled", "Sable", "Rustling", "Weathered", "Drifting", "Faded",
];

export const LOCATION_NAME_NOUNS: string[] = [
  "Lantern", "Bell", "Anchor", "Raven", "Oak", "Stag", "Kettle", "Compass", "Candle",
  "Wheel", "Crown", "Well", "Hearth", "Fox", "Tide",
  "Millstone", "Cauldron", "Spire", "Harbor", "Willow", "Ember",
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
  "The ceiling beams are carved with names, but none of them match anyone locals can name.",
  "A single window is bricked over from the inside, for reasons no one currently living remembers.",
  "The stairs have an extra step that doesn't seem to appear until you've counted wrong at least once.",
  "A collection of keys hangs by the door, none of which fit any lock still standing.",
  "Every mirror in the building has been turned to face the wall.",
  "The floor tilts just enough that spilled drinks always run toward the same corner.",
  "A patch of the garden refuses to grow anything but the same stubborn weed.",
  "Scorch marks on the ceiling trace a shape no one has managed to explain.",
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
  "Kept by a former soldier who still salutes anyone who startles them.",
  "Cared for by siblings who inherited it and can't agree on what to do with it.",
  "Watched by a retired sailor who talks to the building as much as to visitors.",
  "Left to a caretaker hired sight-unseen by an owner no one has ever met.",
  "Minded by a scholar who took the job to fund research nobody will explain.",
  "Run, badly, by someone clearly better suited to a different line of work.",
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
  "A previous tenant is said to have paid a full year's rent in advance and never once stayed the night.",
  "Some claim the building was moved, stone by stone, from somewhere else entirely.",
  "A local historian insists the place appears on no map older than a decade, despite looking far older.",
  "Whoever built it is said to have vanished the same week it was finished.",
  "A traveling performer once refused to set foot inside, and never explained why.",
  "The previous owner's will is rumored to include a condition no one has met yet.",
  "Some nights, light is seen inside long after everyone swears the doors were locked.",
  "A rival business owner has tried, and failed, to buy the place three separate times.",
];

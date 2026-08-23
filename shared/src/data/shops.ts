export interface ShopArchetypeDef {
  id: string;
  name: string;
  itemCategories: string[];
  description: string;
}

export const SHOP_ARCHETYPES: ShopArchetypeDef[] = [
  {
    id: "general-store",
    name: "General Store",
    itemCategories: ["trinket", "tool", "potion"],
    description: "A cramped shop stocked with a bit of everything a traveler might need.",
  },
  {
    id: "blacksmith",
    name: "Blacksmith",
    itemCategories: ["weapon", "armor"],
    description: "The ring of hammer on anvil never quite stops here.",
  },
  {
    id: "alchemist",
    name: "Alchemist",
    itemCategories: ["potion", "trinket"],
    description: "Shelves crowded with bottles, jars, and things better left unlabeled.",
  },
  {
    id: "fletcher",
    name: "Fletcher & Bowyer",
    itemCategories: ["weapon", "tool"],
    description: "The smell of fresh-cut wood and bowstring wax fills the air.",
  },
  {
    id: "jeweler",
    name: "Jeweler & Curiosities",
    itemCategories: ["wondrous", "trinket"],
    description: "Glass cases glitter with more than the shop can really afford to insure.",
  },
  {
    id: "magic-curiosities",
    name: "Magic Curiosities Dealer",
    itemCategories: ["wondrous", "potion"],
    description: "Nothing on these shelves behaves quite the way it should.",
  },
  {
    id: "tavern-sundries",
    name: "Tavern Sundries",
    itemCategories: ["trinket", "instrument", "potion"],
    description: "A little bit of everything the tavern doesn't already sell at the bar.",
  },
  {
    id: "outfitter",
    name: "Adventuring Outfitter",
    itemCategories: ["tool", "armor", "weapon"],
    description: "Packs, rope, and gear for anyone about to do something unwise.",
  },
  {
    id: "cartographer",
    name: "Cartographer's Shop",
    itemCategories: ["tool", "trinket"],
    description: "Maps of every quality paper the walls, some clearly more honest than others.",
  },
  {
    id: "herbalist",
    name: "Herbalist",
    itemCategories: ["potion", "tool"],
    description: "Bundles of drying plants crowd every surface, filling the air with a dozen competing scents.",
  },
  {
    id: "leatherworker",
    name: "Leatherworker",
    itemCategories: ["armor", "tool"],
    description: "Hides in every stage of tanning hang from the racks, and the smell takes some getting used to.",
  },
  {
    id: "bookbinder",
    name: "Bookbinder & Scrivener",
    itemCategories: ["trinket", "tool"],
    description: "Ink-stained fingers and the smell of fresh binding glue greet anyone who walks in.",
  },
];

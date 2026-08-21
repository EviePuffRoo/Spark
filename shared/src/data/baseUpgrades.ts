import type { BaseUpgradeDef } from "../types.js";

// A curated first slice of the home-base upgrade tree — enough to prove
// the mechanic (gold sink, prerequisites, mutually-exclusive branches)
// without building out the full sprawling tree yet.
//
// Effects ship in slices: Defenses, Trade, and Influence carry real,
// coded effects (a defenseRating stat, an actually-generated Shop,
// automated Faction.reputation deltas) as of this pass. Comfort is still
// flavor-only, pending its own effect kind (a real rest bonus) — not left
// that way permanently, just not built yet.
export const BASE_UPGRADES: BaseUpgradeDef[] = [
  { id: "palisade-fence", name: "Palisade Fence", description: "A simple wooden palisade rings the base — enough to keep out wandering beasts and casual trouble.", category: "defenses", cost: 50, effect: { kind: "defenseRating", value: 2 } },
  { id: "stone-walls", name: "Stone Walls", description: "Real stone walls replace the palisade. The base can withstand a real siege now.", category: "defenses", cost: 200, prerequisiteIds: ["palisade-fence"], exclusiveGroup: "defenses-wall", effect: { kind: "defenseRating", value: 8 } },
  { id: "living-hedge-maze", name: "Living Hedge Maze", description: "A cunning, ever-shifting hedge maze replaces the palisade — harder to breach, and it plays tricks on anyone who doesn't know its paths.", category: "defenses", cost: 200, prerequisiteIds: ["palisade-fence"], exclusiveGroup: "defenses-wall", effect: { kind: "defenseRating", value: 8 } },
  { id: "watchtower", name: "Watchtower", description: "A tower gives sentries a commanding view of the approach.", category: "defenses", cost: 150, prerequisiteIds: ["palisade-fence"], effect: { kind: "defenseRating", value: 3 } },

  { id: "trade-post", name: "Trade Post", description: "A modest stall for selling loot without a trip into town.", category: "trade", cost: 75, effect: { kind: "shopUnlock", archetype: "general-store", stockSize: 6 } },
  { id: "resident-blacksmith", name: "Resident Blacksmith", description: "A blacksmith sets up a permanent forge at the base.", category: "trade", cost: 250, prerequisiteIds: ["trade-post"], effect: { kind: "shopUnlock", archetype: "blacksmith", stockSize: 8, priceMultiplier: 0.9 } },
  { id: "exotic-merchant", name: "Exotic Merchant", description: "A traveling merchant with rare wares decides to stay a while.", category: "trade", cost: 300, prerequisiteIds: ["trade-post"], effect: { kind: "shopUnlock", archetype: "magic-curiosities", stockSize: 6 } },

  { id: "thieves-guild-pact", name: "Thieves' Guild Pact", description: "A quiet arrangement with the local Thieves' Guild — fences, informants, and favors, at the cost of the City Watch's trust.", category: "influence", cost: 150, exclusiveGroup: "influence-alliance", effect: { kind: "reputationDelta", value: 20, rivalValue: -15 } },
  { id: "city-watch-charter", name: "City Watch Charter", description: "A formal charter recognized by the City Watch — protection and legitimacy, at the cost of the Thieves' Guild's trust.", category: "influence", cost: 150, exclusiveGroup: "influence-alliance", effect: { kind: "reputationDelta", value: 20, rivalValue: -15 } },
  { id: "herald-of-renown", name: "Herald of Renown", description: "A herald carries word of the party's deeds to every settlement in the region.", category: "influence", cost: 350, effect: { kind: "reputationDelta", value: 15 } },

  { id: "common-room", name: "Common Room", description: "A common room for the party to rest, plan, and recover between sessions.", category: "comfort", cost: 50 },
  { id: "private-quarters", name: "Private Quarters", description: "Private quarters for each party member — a real bed makes a real difference.", category: "comfort", cost: 150, prerequisiteIds: ["common-room"] },
  { id: "library-archive", name: "Library Archive", description: "A growing archive of lore, maps, and rumors the party has collected.", category: "comfort", cost: 200, prerequisiteIds: ["common-room"] },
  { id: "training-yard", name: "Training Yard", description: "A yard for sparring, practice, and keeping sharp between adventures.", category: "comfort", cost: 175, prerequisiteIds: ["common-room"] },
];

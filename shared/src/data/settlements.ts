export interface SettlementTypeDef {
  id: string;
  name: string;
}

export const SETTLEMENT_TYPES: SettlementTypeDef[] = [
  { id: "hamlet", name: "Hamlet" },
  { id: "village", name: "Village" },
  { id: "town", name: "Town" },
  { id: "city", name: "City" },
  { id: "capital", name: "Capital" },
  { id: "fortress-town", name: "Fortress Town" },
  { id: "trade-post", name: "Trade Post" },
  { id: "port", name: "Port" },
];

export const POPULATION_BANDS: Record<string, string> = {
  hamlet: "Fewer than 100",
  village: "100-500",
  town: "500-5,000",
  city: "5,000-25,000",
  capital: "25,000+",
  "fortress-town": "200-2,000",
  "trade-post": "50-400",
  port: "1,000-10,000",
};

export const GOVERNMENT_TYPES: string[] = [
  "Monarchy", "Council of Elders", "Merchant Guild Rule", "Theocracy", "Elected Council",
  "Military Garrison Command", "Anarchic (No Formal Rule)", "Hereditary Chiefdom", "Magistrate-Appointed",
];

export const SETTLEMENT_NAME_ADJECTIVES: string[] = [
  "Amber", "Stonegate", "Farview", "Millbrook", "Ashford", "Thornwell", "Ravensmoor",
  "Goldenhearth", "Wintermere", "Duskwood", "Ironholt", "Sunspire",
];

export const SETTLEMENT_NAME_SUFFIXES: string[] = [
  "ton", "ford", "haven", "burg", "shire", "hollow", "reach", "watch", "gate", "cross", "mere", "fell",
];

export const SETTLEMENT_DESCRIPTIONS: string[] = [
  "A settlement that's grown up around {feature}, and shows no signs of slowing down.",
  "Known throughout the region for {feature}, whether or not that reputation is entirely earned.",
  "Life here revolves around {feature} — it's practically the town's second name.",
  "Visitors are quick to notice {feature}, though locals barely register it anymore.",
  "The settlement's fortunes rise and fall with {feature}.",
  "What outsiders remember most about this place is {feature}.",
  "Founded generations ago around {feature}, the settlement has slowly outgrown its origins.",
  "Every local will eventually mention {feature}, usually unprompted.",
];

export const SETTLEMENT_FEATURES: string[] = [
  "a market that never quite closes",
  "a well-guarded trade route passing right through the center",
  "an old fortification that's outlived its original purpose",
  "a temple whose bells mark every hour",
  "a reputation for producing unusually skilled artisans",
  "a persistent rivalry with a neighboring settlement",
  "a natural resource everyone depends on and no one controls",
  "a festival that draws visitors from well outside the region",
  "a history of changing hands during past conflicts",
  "a council that argues publicly and often",
  "an unusually diverse population for its size",
  "a landmark visible from every corner of town",
];

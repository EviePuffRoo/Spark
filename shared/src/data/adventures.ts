export const ADVENTURE_TITLE_ADJECTIVES: string[] = [
  "Last", "Hollow", "Waking", "Bitter", "Unfinished", "Silent", "Long", "Final",
  "Buried", "Restless", "Broken", "Uneasy",
];

export const ADVENTURE_TITLE_NOUNS: string[] = [
  "Reckoning", "Bargain", "Descent", "Vigil", "Inheritance", "Crossing",
  "Debt", "Hour", "Gambit", "Stand", "Return", "Verdict",
];

// Templates use {questGiver}, {antagonist}, {startLocation}, {climaxLocation},
// and {reward} placeholders, substituted with the actual chosen cast names.
export const ADVENTURE_PREMISES: string[] = [
  "When {questGiver} calls for help against {antagonist}, the trail leads from {startLocation} to a final reckoning at {climaxLocation}.",
  "{antagonist} has been operating in the shadows for too long — {questGiver} finally has proof, and it starts in {startLocation}.",
  "A quiet request from {questGiver} in {startLocation} unravels into a race to stop {antagonist} before {climaxLocation} pays the price.",
  "What begins as a favor for {questGiver} becomes a confrontation with {antagonist}, ending wherever the party makes their stand at {climaxLocation}.",
  "{questGiver} knows something is wrong in {startLocation}. What the party finds points straight at {antagonist} — and a reckoning at {climaxLocation}.",
];

export const ADVENTURE_HOOKS: string[] = [
  "{questGiver} pulls the party aside in {startLocation}, insisting only they can help — the situation involves {antagonist}, and there's no time to explain everything now.",
  "A message arrives from {questGiver}, urging the party to come to {startLocation} at once. Whatever's happening, it's connected to {antagonist}.",
  "In {startLocation}, {questGiver} finally admits what's been troubling them: {antagonist} is behind it, and they're running out of time.",
  "{questGiver} corners the party the moment they arrive in {startLocation}, speaking fast and low about {antagonist}.",
  "Word reaches the party that {questGiver} has been asking after them by name — they're waiting in {startLocation}, and it's about {antagonist}.",
];

export const ADVENTURE_OBJECTIVES: string[] = [
  "Track down what {antagonist} is planning before it's too late, starting with whatever trail can be picked up in {startLocation}.",
  "Get to the bottom of {antagonist}'s scheme and put a stop to it, wherever that trail ends.",
  "Find enough proof of {antagonist}'s involvement to act on it — and be ready to act fast once they do.",
  "Follow {antagonist}'s trail from {startLocation} to wherever it actually leads, and end it there.",
  "Protect what {antagonist} is after long enough to turn the situation around.",
];

export const ADVENTURE_COMPLICATIONS: string[] = [
  "{antagonist} has more resources — and more allies — than anyone expected, and the trail leads somewhere far more dangerous: {climaxLocation}.",
  "By the time the party closes in, {antagonist} is already one step ahead, forcing a confrontation at {climaxLocation} on their terms, not the party's.",
  "{questGiver} isn't telling the whole truth, and untangling it costs the party time {antagonist} doesn't give back.",
  "What looked like a simple job turns out to be tied to something much bigger once the party reaches {climaxLocation}.",
  "{antagonist} knows the party is coming long before they reach {climaxLocation} — and has had time to prepare.",
];

export const ADVENTURE_REWARDS: string[] = [
  "Should the party succeed, {questGiver} has promised {reward} as payment — assuming they survive {climaxLocation} to collect it.",
  "{questGiver} isn't wealthy, but they've offered {reward}, and made clear it's everything they have to give.",
  "Word of stopping {antagonist} will spread on its own, but {questGiver} has also set aside {reward} for the party's trouble.",
  "Whatever else comes of it, {reward} is waiting for whoever walks out of {climaxLocation} still standing.",
  "{questGiver} can't offer much up front, but has sworn {reward} to the party once {antagonist} is dealt with.",
];

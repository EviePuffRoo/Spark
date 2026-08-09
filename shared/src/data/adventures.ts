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
  "Rumors from {startLocation} point to {antagonist}'s hand in something far worse than anyone first suspected, and {questGiver} is the only one willing to say so out loud.",
  "By the time {questGiver} reaches out, {antagonist} already has too much of a head start — the only lead left runs through {startLocation}.",
  "{questGiver} has kept quiet about {antagonist} for as long as they could, but whatever's coming to a head will happen at {climaxLocation}, ready or not.",
  "It starts small: a strange request from {questGiver} in {startLocation}. It doesn't stay small once {antagonist} enters the picture.",
  "{antagonist}'s reach has finally touched {startLocation}, and {questGiver} refuses to let it go any further.",
  "What {questGiver} describes as 'a small problem' in {startLocation} turns out to be {antagonist}, and nothing about it is small.",
  "The trouble {questGiver} won't name outright has a name: {antagonist}. It starts in {startLocation} and doesn't end there.",
  "{questGiver} has run out of people to ask for help — everyone who could deal with {antagonist} is gone, hiding, or worse.",
  "A pattern only {questGiver} noticed in {startLocation} turns out to be {antagonist}'s doing, and no one else believed it until now.",
  "{questGiver} swears this is the last time they'll ask anyone for help with {antagonist} — win or lose, it ends at {climaxLocation}.",
];

export const ADVENTURE_HOOKS: string[] = [
  "{questGiver} pulls the party aside in {startLocation}, insisting only they can help — the situation involves {antagonist}, and there's no time to explain everything now.",
  "A message arrives from {questGiver}, urging the party to come to {startLocation} at once. Whatever's happening, it's connected to {antagonist}.",
  "In {startLocation}, {questGiver} finally admits what's been troubling them: {antagonist} is behind it, and they're running out of time.",
  "{questGiver} corners the party the moment they arrive in {startLocation}, speaking fast and low about {antagonist}.",
  "Word reaches the party that {questGiver} has been asking after them by name — they're waiting in {startLocation}, and it's about {antagonist}.",
  "{questGiver} won't say much in public, only that the party should meet them somewhere quieter in {startLocation} to talk about {antagonist}.",
  "A hurried note, unsigned but clearly from {questGiver}, asks the party to come to {startLocation} before word about {antagonist} spreads any further.",
  "{questGiver} has been asking around {startLocation} for anyone brave — or desperate — enough to deal with {antagonist}.",
  "The party finds {questGiver} waiting outside {startLocation}, too anxious to wait for a proper introduction before mentioning {antagonist}.",
  "{questGiver} slips the party a coin and a warning in {startLocation}: come find them quietly, it's about {antagonist}.",
  "Someone in {startLocation} vouches for the party to {questGiver}, who's been too afraid of {antagonist} to ask anyone directly.",
  "{questGiver} has already tried and failed to handle {antagonist} alone, and makes no secret of it once the party arrives in {startLocation}.",
  "A summons arrives via a nervous courier: {questGiver} needs to see the party in {startLocation}, urgently, about {antagonist}.",
  "{questGiver} recognizes the party from reputation alone and corners them the moment they set foot in {startLocation}, talking fast about {antagonist}.",
  "In {startLocation}, {questGiver} finally works up the nerve to say what's been eating at them — it's {antagonist}, and it's worse than anyone knows.",
];

export const ADVENTURE_OBJECTIVES: string[] = [
  "Track down what {antagonist} is planning before it's too late, starting with whatever trail can be picked up in {startLocation}.",
  "Get to the bottom of {antagonist}'s scheme and put a stop to it, wherever that trail ends.",
  "Find enough proof of {antagonist}'s involvement to act on it — and be ready to act fast once they do.",
  "Follow {antagonist}'s trail from {startLocation} to wherever it actually leads, and end it there.",
  "Protect what {antagonist} is after long enough to turn the situation around.",
  "Learn exactly what {antagonist} wants before they get it, and be in position to stop them when they try.",
  "Cut off {antagonist}'s plans at the source, wherever that turns out to actually be.",
  "Gather enough allies and evidence to move against {antagonist} before they finish whatever they've started.",
  "Trace every lead {antagonist} has left behind, starting in {startLocation}, until the picture is finally clear.",
  "Keep {antagonist} from finishing what they started, by whatever means the party can manage.",
  "Confront {antagonist} on the party's terms, not theirs, before the situation spirals further.",
  "Uncover who's really backing {antagonist} before deciding how far this goes.",
  "Buy enough time for the people of {startLocation} to prepare for whatever {antagonist} intends.",
  "Bring {antagonist} to a reckoning, one way or another, wherever that ends up happening.",
  "Get ahead of {antagonist} for once, instead of always reacting a step behind.",
];

export const ADVENTURE_COMPLICATIONS: string[] = [
  "{antagonist} has more resources — and more allies — than anyone expected, and the trail leads somewhere far more dangerous: {climaxLocation}.",
  "By the time the party closes in, {antagonist} is already one step ahead, forcing a confrontation at {climaxLocation} on their terms, not the party's.",
  "{questGiver} isn't telling the whole truth, and untangling it costs the party time {antagonist} doesn't give back.",
  "What looked like a simple job turns out to be tied to something much bigger once the party reaches {climaxLocation}.",
  "{antagonist} knows the party is coming long before they reach {climaxLocation} — and has had time to prepare.",
  "The closer the party gets, the clearer it becomes that {antagonist} was never working alone — and the real fight waits at {climaxLocation}.",
  "{antagonist} has a contingency for exactly this, and springs it the moment the party reaches {climaxLocation}.",
  "Someone the party trusted has been reporting to {antagonist} the whole time, and the truth comes out too late to change much.",
  "{questGiver}'s information turns out to be outdated, sending the party into {climaxLocation} far less prepared than they thought.",
  "{antagonist} offers a deal at {climaxLocation} that's tempting enough to split the party's resolve.",
  "What {antagonist} is protecting at {climaxLocation} turns out to be far more sympathetic — or far more dangerous — than expected.",
  "The clock runs out faster than promised, and the party reaches {climaxLocation} with far less room to plan than they wanted.",
  "{antagonist} was expecting reinforcements, and they arrive at {climaxLocation} right as the party does.",
  "The path to {climaxLocation} extracts a cost of its own, before {antagonist} even enters the picture.",
  "{questGiver} makes one last desperate move that changes everything just as the party reaches {climaxLocation}.",
];

export const ADVENTURE_REWARDS: string[] = [
  "Should the party succeed, {questGiver} has promised {reward} as payment — assuming they survive {climaxLocation} to collect it.",
  "{questGiver} isn't wealthy, but they've offered {reward}, and made clear it's everything they have to give.",
  "Word of stopping {antagonist} will spread on its own, but {questGiver} has also set aside {reward} for the party's trouble.",
  "Whatever else comes of it, {reward} is waiting for whoever walks out of {climaxLocation} still standing.",
  "{questGiver} can't offer much up front, but has sworn {reward} to the party once {antagonist} is dealt with.",
  "{questGiver} has little to spare, but insists the party take {reward} regardless, once {antagonist} is dealt with.",
  "In gratitude, {questGiver} arranges for {reward} to reach the party, no questions asked.",
  "{reward} awaits at {climaxLocation}, promised by {questGiver} long before the party ever agreed to go.",
  "Once word spreads that {antagonist} has been stopped, {questGiver} makes good on the promise of {reward}.",
  "{questGiver} calls in a favor on the party's behalf, securing {reward} as thanks.",
  "There's no fanfare, just {reward}, quietly handed over by {questGiver} once it's finally over.",
  "{questGiver} had been saving {reward} for exactly this kind of trouble, and hands it over without hesitation.",
  "Whatever else happens, {reward} is waiting for the party the moment {antagonist} is no longer a threat.",
  "{questGiver} makes sure {reward} finds its way to the party, even if they never meet again after {climaxLocation}.",
  "The people of {startLocation} chip in alongside {questGiver} to make sure {reward} is worth the trouble.",
];

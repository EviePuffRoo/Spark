import type { AchievementDef } from "../types.js";

// Party-level achievements: computed per world from data that's already
// logged (roll log, ledger, session notes, chat, roster entries), not a
// new event stream. Deliberately weighted toward showing up and telling
// the story — sessions logged, quests seen through — over pure stat
// grinding, so this rewards the same things worth celebrating at the
// table rather than nudging anyone toward min-maxing for a badge.
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-blood", name: "First Blood", description: "Roll a natural 20.", category: "dice" },
  { id: "hat-trick", name: "Hat Trick", description: "Roll three natural 20s in this world.", category: "dice", target: 3 },
  { id: "it-happens", name: "It Happens", description: "Roll a natural 1.", category: "dice" },
  { id: "cursed", name: "Cursed", description: "Roll five natural 1s in this world.", category: "dice", target: 5 },
  { id: "warming-up", name: "Warming Up", description: "Log 50 rolls in this world.", category: "dice", target: 50 },
  { id: "dice-goblin", name: "Dice Goblin", description: "Log 500 rolls in this world.", category: "dice", target: 500 },

  { id: "quest-accepted", name: "Quest Accepted", description: "Complete your first quest.", category: "quests" },
  { id: "adventuring-company", name: "Adventuring Company", description: "Complete 10 quests.", category: "quests", target: 10 },
  { id: "legends-of-the-realm", name: "Legends of the Realm", description: "Complete 25 quests.", category: "quests", target: 25 },

  { id: "first-coin", name: "First Coin", description: "Log your first gold transaction.", category: "economy" },
  { id: "comfortable", name: "Comfortable", description: "The party's gold has ever reached 500.", category: "economy", target: 500 },
  { id: "wealthy", name: "Wealthy", description: "The party's gold has ever reached 2,500.", category: "economy", target: 2500 },
  { id: "filthy-rich", name: "Filthy Rich", description: "The party's gold has ever reached 10,000.", category: "economy", target: 10000 },

  { id: "session-zero", name: "Session Zero", description: "Log your first session note.", category: "social" },
  { id: "regulars", name: "Regulars", description: "Log 10 session notes.", category: "social", target: 10 },
  { id: "the-long-campaign", name: "The Long Campaign", description: "Log 50 session notes.", category: "social", target: 50 },
  { id: "full-table", name: "Full Table", description: "Get 4 or more people into this world.", category: "social", target: 4 },
  { id: "chatterbox", name: "Chatterbox", description: "Send 100 chat messages in this world.", category: "social", target: 100 },

  { id: "world-builder", name: "World Builder", description: "Save 50 roster entries in this world.", category: "legacy", target: 50 },
];

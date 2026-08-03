export interface BackgroundDef {
  id: string;
  name: string;
  skills: string[];
  flavor: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: "acolyte", name: "Acolyte", skills: ["Insight", "Religion"], flavor: "Spent their formative years in service to a temple or shrine." },
  { id: "charlatan", name: "Charlatan", skills: ["Deception", "Sleight of Hand"], flavor: "Has made a living out of convincing people that lies are truths." },
  { id: "criminal", name: "Criminal", skills: ["Deception", "Stealth"], flavor: "An experienced lawbreaker with a network of shady contacts." },
  { id: "entertainer", name: "Entertainer", skills: ["Acrobatics", "Performance"], flavor: "Thrives in front of a crowd, living gig to gig." },
  { id: "folk-hero", name: "Folk Hero", skills: ["Animal Handling", "Survival"], flavor: "Stood up against a tyrant or monster and became a local legend." },
  { id: "guild-artisan", name: "Guild Artisan", skills: ["Insight", "Persuasion"], flavor: "A respected member of a trade guild, skilled at their craft." },
  { id: "hermit", name: "Hermit", skills: ["Medicine", "Religion"], flavor: "Lived in seclusion, seeking a great truth or hiding from the world." },
  { id: "noble", name: "Noble", skills: ["History", "Persuasion"], flavor: "Raised in wealth and privilege, well-versed in courtly matters." },
  { id: "outlander", name: "Outlander", skills: ["Athletics", "Survival"], flavor: "Grew up in the wilds, far from civilization's comforts." },
  { id: "sage", name: "Sage", skills: ["Arcana", "History"], flavor: "Spent years in libraries and archives pursuing knowledge." },
  { id: "sailor", name: "Sailor", skills: ["Athletics", "Perception"], flavor: "Has sailed on a seagoing vessel for years, weathering storms and mutinies." },
  { id: "soldier", name: "Soldier", skills: ["Athletics", "Intimidation"], flavor: "Trained and fought as part of an organized military force." },
  { id: "urchin", name: "Urchin", skills: ["Sleight of Hand", "Stealth"], flavor: "Grew up on the streets, surviving by wit and quick fingers." },
];

import { useEffect, useState } from "react";
import { api, type WorldSummary } from "../api";
import { useLocalStorage } from "../useLocalStorage";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

// Self-contained and self-hiding, same convention as the other Overview
// panels (LastSessionPanel, AchievementsPanel, etc.): owns its own fetch
// and its own dismissed state, keyed per-world since "getting started" on
// one campaign says nothing about another. Only shown to the world's
// owner — a joining player already completed their own onboarding step
// (using the join code) and doesn't need a DM-facing checklist.
export function GettingStartedPanel({ world }: { world: WorldSummary }) {
  const [dismissed, setDismissed] = useLocalStorage(`spark-getting-started-dismissed-${world.id}`, false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [rolledDice, setRolledDice] = useState<boolean | null>(null);

  useEffect(() => {
    if (dismissed || !world.isOwner) return;
    api.getWorldMembers(world.id).then((m) => setMemberCount(m.length)).catch(() => {});
    api.listRollLog(world.id).then((r) => setRolledDice(r.length > 0)).catch(() => {});
  }, [world.id, world.isOwner, dismissed]);

  if (dismissed || !world.isOwner) return null;

  const hasRosterContent =
    world.characterCount + world.itemCount + world.locationCount + world.questCount + world.factionCount > 0;

  const items: ChecklistItem[] = [
    { key: "roster", label: "Add something to your Roster (from the Prep tab)", done: hasRosterContent },
    { key: "invite", label: "Invite a player with this world's join code (Worlds tab)", done: memberCount !== null && memberCount > 1 },
    { key: "play", label: "Roll some dice on the Play tab", done: rolledDice === true },
  ];

  // Once every item is checked, the panel has done its job — quietly get
  // out of the way instead of lingering as a "you're all done!" banner.
  if (items.every((item) => item.done)) return null;

  return (
    <div className="panel getting-started-panel">
      <h3 className="section-heading">Getting Started</h3>
      <ul className="getting-started-list">
        {items.map((item) => (
          <li key={item.key} className={item.done ? "done" : ""}>
            <span aria-hidden="true">{item.done ? "✓" : "○"}</span> {item.label}
          </li>
        ))}
      </ul>
      <button className="link-button" onClick={() => setDismissed(true)}>Dismiss</button>
    </div>
  );
}

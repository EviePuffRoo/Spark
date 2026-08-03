import { useEffect } from "react";
import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter } from "@spark/shared";
import { StatBlockView } from "./StatBlockView";
import { BackstoryView } from "./BackstoryView";
import { ItemCardView } from "./ItemCardView";
import { LocationCardView } from "./LocationCardView";
import { QuestHookCardView } from "./QuestHookCardView";
import { FactionCardView } from "./FactionCardView";
import { EncounterTableCardView } from "./EncounterTableCardView";
import { SessionNoteCardView } from "./SessionNoteCardView";
import { AdventureCardView } from "./AdventureCardView";
import { PlayerCharacterCardView } from "./PlayerCharacterCardView";

export type PrintItem =
  | { type: "character"; data: Character }
  | { type: "item"; data: Item }
  | { type: "location"; data: Location }
  | { type: "quest"; data: QuestHook }
  | { type: "faction"; data: Faction }
  | { type: "encounterTable"; data: EncounterTable }
  | { type: "sessionNote"; data: SessionNote }
  | { type: "adventure"; data: Adventure }
  | { type: "playerCharacter"; data: PlayerCharacter };

export function PrintPane({ items }: { items: PrintItem[] | null }) {
  useEffect(() => {
    if (!items || items.length === 0) return;
    const timer = setTimeout(() => window.print(), 80);
    return () => clearTimeout(timer);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div id="print-root">
      {items.map((item, index) => (
        <div className="print-page" key={`${item.type}-${item.data.id}-${index}`}>
          {item.type === "character" && (
            <>
              <StatBlockView
                name={item.data.name}
                subtitle={`${item.data.statBlock.size} ${item.data.statBlock.creatureType}, ${item.data.statBlock.alignment}${item.data.race ? ` — ${item.data.race}` : ""}${item.data.background ? `, ${item.data.background}` : ""}`}
                statBlock={item.data.statBlock}
              />
              <BackstoryView backstory={item.data.backstory} />
            </>
          )}
          {item.type === "item" && <ItemCardView item={item.data} />}
          {item.type === "location" && <LocationCardView location={item.data} />}
          {item.type === "quest" && <QuestHookCardView quest={item.data} />}
          {item.type === "faction" && <FactionCardView faction={item.data} />}
          {item.type === "encounterTable" && <EncounterTableCardView table={item.data} />}
          {item.type === "sessionNote" && <SessionNoteCardView note={item.data} />}
          {item.type === "adventure" && <AdventureCardView adventure={item.data} />}
          {item.type === "playerCharacter" && <PlayerCharacterCardView pc={item.data} />}
        </div>
      ))}
    </div>
  );
}

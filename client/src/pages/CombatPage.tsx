import { useEffect, useState } from "react";
import { api, type WorldSummary } from "../api";
import { useLocalStorage } from "../useLocalStorage";
import { DiceRoller } from "../components/DiceRoller";
import { InitiativeTracker } from "../components/InitiativeTracker";

export function CombatPage() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [partyWorldId, setPartyWorldId] = useLocalStorage("spark-combat-world-id", "");

  useEffect(() => {
    api.listWorlds().then(setWorlds).catch(() => {});
  }, []);

  return (
    <div className="page generator-layout">
      <DiceRoller worlds={worlds} partyWorldId={partyWorldId} setPartyWorldId={setPartyWorldId} />
      <InitiativeTracker worlds={worlds} partyWorldId={partyWorldId} setPartyWorldId={setPartyWorldId} />
    </div>
  );
}

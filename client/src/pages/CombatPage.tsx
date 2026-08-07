import { useActiveWorld } from "../ActiveWorldContext";
import { DiceRoller } from "../components/DiceRoller";
import { InitiativeTracker } from "../components/InitiativeTracker";

export function CombatPage() {
  const { worlds, worldId, setWorldId } = useActiveWorld();

  return (
    <div className="page generator-layout">
      <DiceRoller worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} />
      <InitiativeTracker worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} />
    </div>
  );
}

import { useActiveWorld } from "../ActiveWorldContext";
import { DiceRoller } from "../components/DiceRoller";
import { InitiativeTracker } from "../components/InitiativeTracker";
import { ChatPanel } from "../components/ChatPanel";

export function CombatPage() {
  const { worlds, worldId, setWorldId } = useActiveWorld();

  return (
    <div className="page generator-layout">
      <div className="combat-left-column">
        <DiceRoller worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} />
        {worldId && <ChatPanel worldId={worldId} worlds={worlds} />}
      </div>
      <InitiativeTracker worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} />
    </div>
  );
}

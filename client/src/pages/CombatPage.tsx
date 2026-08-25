import { useActiveWorld } from "../ActiveWorldContext";
import { useLocalStorage } from "../useLocalStorage";
import { DiceRoller } from "../components/DiceRoller";
import { InitiativeTracker } from "../components/InitiativeTracker";
import { ChatPanel } from "../components/ChatPanel";

export function CombatPage() {
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [toolsCollapsed, setToolsCollapsed] = useLocalStorage("spark-combat-tools-collapsed", false);

  // Opening a map is the moment the tools column is most likely to be in
  // the way — auto-collapse it then, so the map isn't left squeezed
  // against a fixed-width sidebar it doesn't need. Never auto-re-expands
  // on close; that stays the DM's call via the toggle button.
  function handleMapActiveChange(active: boolean) {
    if (active) setToolsCollapsed(true);
  }

  return (
    <div className={`page combat-layout${toolsCollapsed ? " combat-tools-collapsed" : ""}`}>
      <div className="combat-left-column">
        <button
          className="btn-secondary combat-tools-toggle"
          aria-expanded={!toolsCollapsed}
          onClick={() => setToolsCollapsed((v) => !v)}
        >
          {toolsCollapsed ? "☰" : "Hide Tools"}
        </button>
        {toolsCollapsed ? (
          <div className="combat-tools-collapsed-rail" aria-hidden="true" />
        ) : (
          <>
            <DiceRoller worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} />
            {worldId && <ChatPanel worldId={worldId} worlds={worlds} />}
          </>
        )}
      </div>
      <InitiativeTracker worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} onMapActiveChange={handleMapActiveChange} />
    </div>
  );
}

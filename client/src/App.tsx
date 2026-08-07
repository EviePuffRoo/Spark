import { useState } from "react";
import "./App.css";
import type { EntityType } from "@spark/shared";
import { useAuth } from "./AuthContext";
import { ActiveWorldProvider, useActiveWorld } from "./ActiveWorldContext";
import { useActivityBadges } from "./useActivityBadges";
import { AuthPage } from "./pages/AuthPage";
import { AccountMenu } from "./components/AccountMenu";
import { ThemeToggle } from "./components/ThemeToggle";
import { RecoveryCodeDisplay } from "./components/RecoveryCodeDisplay";
import { CreatePage } from "./pages/CreatePage";
import { SessionNotesPage } from "./pages/SessionNotesPage";
import { RosterPage, type RosterSelection } from "./pages/RosterPage";
import { WorldsPage } from "./pages/WorldsPage";
import { CombatPage } from "./pages/CombatPage";
import { MyCharacterPage } from "./pages/MyCharacterPage";
import { CodexPage } from "./pages/CodexPage";
import { InventoryPage } from "./pages/InventoryPage";
import { ShopPage } from "./pages/ShopPage";
import { GlobalSearch } from "./components/GlobalSearch";
import { PrintPane, type PrintItem } from "./components/PrintPane";

type Area = "prep" | "world" | "play";
type SubTab = "create" | "myCharacter" | "worlds" | "roster" | "codex" | "notes" | "combat" | "shop" | "inventory";

const AREA_LABELS: Record<Area, string> = { prep: "Prep", world: "World", play: "Play" };
const AREA_DEFAULT_SUBTAB: Record<Area, SubTab> = { prep: "create", world: "worlds", play: "combat" };

function App() {
  const { user, loading, pendingRecoveryCode } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Spark</h1>
          <p className="tagline">Loading…</p>
        </header>
      </div>
    );
  }
  if (!user) return <AuthPage />;
  if (pendingRecoveryCode) return <RecoveryCodeDisplay code={pendingRecoveryCode} />;

  return (
    <ActiveWorldProvider>
      <AppShell />
    </ActiveWorldProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const { combatUnseen, notesUnseen, codexUnseen, inventoryUnseen, markSeen } = useActivityBadges(!!user);
  const [area, setArea] = useState<Area>("prep");
  const [subTab, setSubTab] = useState<SubTab>("create");
  const [rosterWorldFilter, setRosterWorldFilter] = useState("");
  const [rosterSelection, setRosterSelection] = useState<RosterSelection | null>(null);
  const [printItems, setPrintItems] = useState<PrintItem[] | null>(null);

  function selectArea(next: Area) {
    setArea(next);
    setSubTab(AREA_DEFAULT_SUBTAB[next]);
  }

  function selectSubTab(next: SubTab) {
    setSubTab(next);
    if (next === "codex") markSeen("codex");
    else if (next === "notes") markSeen("notes");
    else if (next === "combat") markSeen("combat");
    else if (next === "inventory") markSeen("inventory");
  }

  function viewRosterForWorld(worldIdToView: string) {
    setRosterWorldFilter(worldIdToView);
    setArea("world");
    setSubTab("roster");
  }

  function openInRoster(type: EntityType, id: string) {
    setRosterSelection({ type, id });
    setArea("world");
    setSubTab("roster");
  }

  const worldAreaUnseen = notesUnseen || codexUnseen;
  const playAreaUnseen = combatUnseen || inventoryUnseen;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-actions">
          {worlds.length > 0 && (
            <select
              className="active-world-select"
              aria-label="Active world"
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
            >
              <option value="">No world selected</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <ThemeToggle />
          <AccountMenu />
        </div>
        <h1>Spark</h1>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>
        <GlobalSearch onSelect={openInRoster} />

        <nav className="tabs area-tabs">
          {(Object.keys(AREA_LABELS) as Area[]).map((a) => (
            <button key={a} className={area === a ? "active" : ""} aria-current={area === a ? "true" : undefined} onClick={() => selectArea(a)}>
              {AREA_LABELS[a]}
              {a === "world" && worldAreaUnseen && <span className="nav-badge" aria-label="New world activity" />}
              {a === "play" && playAreaUnseen && <span className="nav-badge" aria-label="New play activity" />}
            </button>
          ))}
        </nav>

        <nav className="tabs area-subtabs">
          {area === "prep" && (
            <>
              <button className={subTab === "create" ? "active" : ""} aria-current={subTab === "create" ? "true" : undefined} onClick={() => selectSubTab("create")}>Create</button>
              <button className={subTab === "myCharacter" ? "active" : ""} aria-current={subTab === "myCharacter" ? "true" : undefined} onClick={() => selectSubTab("myCharacter")}>My Character</button>
            </>
          )}
          {area === "world" && (
            <>
              <button className={subTab === "worlds" ? "active" : ""} aria-current={subTab === "worlds" ? "true" : undefined} onClick={() => selectSubTab("worlds")}>Worlds</button>
              <button className={subTab === "roster" ? "active" : ""} aria-current={subTab === "roster" ? "true" : undefined} onClick={() => selectSubTab("roster")}>Roster</button>
              <button className={subTab === "codex" ? "active" : ""} aria-current={subTab === "codex" ? "true" : undefined} onClick={() => selectSubTab("codex")}>
                Codex{codexUnseen && <span className="nav-badge" aria-label="New codex activity" />}
              </button>
              <button className={subTab === "notes" ? "active" : ""} aria-current={subTab === "notes" ? "true" : undefined} onClick={() => selectSubTab("notes")}>
                Notes{notesUnseen && <span className="nav-badge" aria-label="New notes activity" />}
              </button>
            </>
          )}
          {area === "play" && (
            <>
              <button className={subTab === "combat" ? "active" : ""} aria-current={subTab === "combat" ? "true" : undefined} onClick={() => selectSubTab("combat")}>
                Combat{combatUnseen && <span className="nav-badge" aria-label="New combat activity" />}
              </button>
              <button className={subTab === "shop" ? "active" : ""} aria-current={subTab === "shop" ? "true" : undefined} onClick={() => selectSubTab("shop")}>Shop</button>
              <button className={subTab === "inventory" ? "active" : ""} aria-current={subTab === "inventory" ? "true" : undefined} onClick={() => selectSubTab("inventory")}>
                Inventory{inventoryUnseen && <span className="nav-badge" aria-label="New inventory activity" />}
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        {subTab === "create" && <CreatePage />}
        {subTab === "myCharacter" && <MyCharacterPage onViewRoster={viewRosterForWorld} />}
        {subTab === "worlds" && <WorldsPage onViewRoster={viewRosterForWorld} />}
        {subTab === "roster" && (
          <RosterPage
            worldFilter={rosterWorldFilter}
            onWorldFilterChange={setRosterWorldFilter}
            pendingSelection={rosterSelection}
            onConsumeSelection={() => setRosterSelection(null)}
            onPrint={setPrintItems}
          />
        )}
        {subTab === "codex" && <CodexPage />}
        {subTab === "notes" && <SessionNotesPage />}
        {subTab === "combat" && <CombatPage />}
        {subTab === "shop" && <ShopPage />}
        {subTab === "inventory" && <InventoryPage />}
      </main>

      <PrintPane items={printItems} />
    </div>
  );
}

export default App;

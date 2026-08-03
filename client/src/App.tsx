import { useState } from "react";
import "./App.css";
import type { EntityType } from "@spark/shared";
import { useAuth } from "./AuthContext";
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
import { GlobalSearch } from "./components/GlobalSearch";
import { PrintPane, type PrintItem } from "./components/PrintPane";

type Tab = "create" | "notes" | "roster" | "myCharacter" | "worlds" | "combat";

function App() {
  const { user, loading, pendingRecoveryCode } = useAuth();
  const [tab, setTab] = useState<Tab>("create");
  const [rosterWorldFilter, setRosterWorldFilter] = useState("");
  const [rosterSelection, setRosterSelection] = useState<RosterSelection | null>(null);
  const [printItems, setPrintItems] = useState<PrintItem[] | null>(null);

  function viewRosterForWorld(worldId: string) {
    setRosterWorldFilter(worldId);
    setTab("roster");
  }

  function openInRoster(type: EntityType, id: string) {
    setRosterSelection({ type, id });
    setTab("roster");
  }

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
    <div className="app">
      <header className="app-header">
        <div className="app-header-actions">
          <ThemeToggle />
          <AccountMenu />
        </div>
        <h1>Spark</h1>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>
        <GlobalSearch onSelect={openInRoster} />
        <nav className="tabs">
          <button className={tab === "create" ? "active" : ""} aria-current={tab === "create" ? "true" : undefined} onClick={() => setTab("create")}>Create</button>
          <button className={tab === "notes" ? "active" : ""} aria-current={tab === "notes" ? "true" : undefined} onClick={() => setTab("notes")}>Notes</button>
          <button className={tab === "roster" ? "active" : ""} aria-current={tab === "roster" ? "true" : undefined} onClick={() => setTab("roster")}>Roster</button>
          <button className={tab === "myCharacter" ? "active" : ""} aria-current={tab === "myCharacter" ? "true" : undefined} onClick={() => setTab("myCharacter")}>My Character</button>
          <button className={tab === "worlds" ? "active" : ""} aria-current={tab === "worlds" ? "true" : undefined} onClick={() => setTab("worlds")}>Worlds</button>
          <button className={tab === "combat" ? "active" : ""} aria-current={tab === "combat" ? "true" : undefined} onClick={() => setTab("combat")}>Combat</button>
        </nav>
      </header>

      <main>
        {tab === "create" && <CreatePage />}
        {tab === "notes" && <SessionNotesPage />}
        {tab === "roster" && (
          <RosterPage
            worldFilter={rosterWorldFilter}
            onWorldFilterChange={setRosterWorldFilter}
            pendingSelection={rosterSelection}
            onConsumeSelection={() => setRosterSelection(null)}
            onPrint={setPrintItems}
          />
        )}
        {tab === "myCharacter" && <MyCharacterPage onViewRoster={viewRosterForWorld} />}
        {tab === "worlds" && <WorldsPage onViewRoster={viewRosterForWorld} />}
        {tab === "combat" && <CombatPage />}
      </main>

      <PrintPane items={printItems} />
    </div>
  );
}

export default App;

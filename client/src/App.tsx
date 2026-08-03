import { useState } from "react";
import "./App.css";
import { CreatePage } from "./pages/CreatePage";
import { SessionNotesPage } from "./pages/SessionNotesPage";
import { RosterPage } from "./pages/RosterPage";
import { WorldsPage } from "./pages/WorldsPage";

type Tab = "create" | "notes" | "roster" | "worlds";

function App() {
  const [tab, setTab] = useState<Tab>("create");
  const [rosterWorldFilter, setRosterWorldFilter] = useState("");

  function viewRosterForWorld(worldId: string) {
    setRosterWorldFilter(worldId);
    setTab("roster");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spark</h1>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>
        <nav className="tabs">
          <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Create</button>
          <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Notes</button>
          <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>Roster</button>
          <button className={tab === "worlds" ? "active" : ""} onClick={() => setTab("worlds")}>Worlds</button>
        </nav>
      </header>

      <main>
        {tab === "create" && <CreatePage />}
        {tab === "notes" && <SessionNotesPage />}
        {tab === "roster" && (
          <RosterPage worldFilter={rosterWorldFilter} onWorldFilterChange={setRosterWorldFilter} />
        )}
        {tab === "worlds" && <WorldsPage onViewRoster={viewRosterForWorld} />}
      </main>
    </div>
  );
}

export default App;

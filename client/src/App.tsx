import { useState } from "react";
import "./App.css";
import { GeneratorPage } from "./pages/GeneratorPage";
import { RosterPage } from "./pages/RosterPage";
import { WorldsPage } from "./pages/WorldsPage";

type Tab = "generator" | "roster" | "worlds";

function App() {
  const [tab, setTab] = useState<Tab>("generator");
  const [rosterWorldFilter, setRosterWorldFilter] = useState("");

  function viewRosterForWorld(worldId: string) {
    setRosterWorldFilter(worldId);
    setTab("roster");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Spark</h1>
        <p className="tagline">Memorable NPCs &amp; monsters, ready for the table</p>
        <nav className="tabs">
          <button className={tab === "generator" ? "active" : ""} onClick={() => setTab("generator")}>Generator</button>
          <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>Roster</button>
          <button className={tab === "worlds" ? "active" : ""} onClick={() => setTab("worlds")}>Worlds</button>
        </nav>
      </header>

      <main>
        {tab === "generator" && <GeneratorPage />}
        {tab === "roster" && (
          <RosterPage worldFilter={rosterWorldFilter} onWorldFilterChange={setRosterWorldFilter} />
        )}
        {tab === "worlds" && <WorldsPage onViewRoster={viewRosterForWorld} />}
      </main>
    </div>
  );
}

export default App;

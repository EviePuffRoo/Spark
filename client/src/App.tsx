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
import { WorldOverviewPage, type OverviewNavTarget } from "./pages/WorldOverviewPage";
import { CombatPage } from "./pages/CombatPage";
import { MyCharacterPage } from "./pages/MyCharacterPage";
import { PlayerCompanionView } from "./pages/PlayerCompanionView";
import { CompendiumPage } from "./pages/CompendiumPage";
import { BillingPage } from "./pages/BillingPage";
import { CodexPage } from "./pages/CodexPage";
import { GalleryPage } from "./pages/GalleryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DowntimePage } from "./pages/DowntimePage";
import { ShopPage } from "./pages/ShopPage";
import { GlobalSearch } from "./components/GlobalSearch";
import { PrintPane, type PrintItem } from "./components/PrintPane";
import { PrepIcon, WorldIcon, PlayIcon } from "./components/icons";

type Area = "prep" | "world" | "play";
type SubTab = "create" | "myCharacter" | "compendium" | "billing" | "overview" | "worlds" | "roster" | "codex" | "notes" | "downtime" | "combat" | "shop" | "inventory" | "gallery";

const AREA_LABELS: Record<Area, string> = { prep: "Prep", world: "World", play: "Play" };
const AREA_ICONS: Record<Area, typeof PrepIcon> = { prep: PrepIcon, world: WorldIcon, play: PlayIcon };
const AREA_DEFAULT_SUBTAB: Record<Area, SubTab> = { prep: "create", world: "overview", play: "combat" };

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

  // ?play=1 is the mobile player-companion entry point (shared/QR-coded to
  // players separately from the full desktop app). Unlike ?present=<worldId>
  // (main.tsx), which intentionally skips auth for the DM's read-only
  // cast-to-TV view, this still requires a normal login — it just swaps the
  // desktop tabbed shell for a mobile-first view once signed in.
  const isPlayMode = new URLSearchParams(window.location.search).get("play") === "1";
  if (isPlayMode) {
    return (
      <ActiveWorldProvider>
        <PlayerCompanionView />
      </ActiveWorldProvider>
    );
  }

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
  // Stripe Checkout/Portal redirects land back on the bare app root — route
  // straight to the Billing tab so its own effect can refresh the tier.
  const returningFromBilling = new URLSearchParams(window.location.search).has("billing");
  const [area, setArea] = useState<Area>("prep");
  const [subTab, setSubTab] = useState<SubTab>(returningFromBilling ? "billing" : "create");
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

  function navigateFromOverview(target: OverviewNavTarget) {
    setArea(target === "shop" ? "play" : "world");
    selectSubTab(target);
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
          <a className="btn-secondary" href="?play=1">Player View</a>
          <ThemeToggle />
          <AccountMenu />
        </div>
        <h1>Spark</h1>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>
        <GlobalSearch onSelect={openInRoster} />

        <nav className="tabs area-tabs">
          {(Object.keys(AREA_LABELS) as Area[]).map((a) => {
            const Icon = AREA_ICONS[a];
            return (
              <button key={a} className={area === a ? "active" : ""} aria-current={area === a ? "true" : undefined} onClick={() => selectArea(a)}>
                <Icon className="nav-icon" aria-hidden="true" />
                {AREA_LABELS[a]}
                {a === "world" && worldAreaUnseen && <span className="nav-badge" aria-label="New world activity" />}
                {a === "play" && playAreaUnseen && <span className="nav-badge" aria-label="New play activity" />}
              </button>
            );
          })}
        </nav>

        <nav className="tabs area-subtabs">
          {area === "prep" && (
            <>
              <button className={subTab === "create" ? "active" : ""} aria-current={subTab === "create" ? "true" : undefined} onClick={() => selectSubTab("create")}>Create</button>
              <button className={subTab === "myCharacter" ? "active" : ""} aria-current={subTab === "myCharacter" ? "true" : undefined} onClick={() => selectSubTab("myCharacter")}>My Character</button>
              <button className={subTab === "compendium" ? "active" : ""} aria-current={subTab === "compendium" ? "true" : undefined} onClick={() => selectSubTab("compendium")}>Compendium</button>
              <button className={subTab === "billing" ? "active" : ""} aria-current={subTab === "billing" ? "true" : undefined} onClick={() => selectSubTab("billing")}>Billing</button>
            </>
          )}
          {area === "world" && (
            <>
              <button className={subTab === "overview" ? "active" : ""} aria-current={subTab === "overview" ? "true" : undefined} onClick={() => selectSubTab("overview")}>Overview</button>
              <button className={subTab === "worlds" ? "active" : ""} aria-current={subTab === "worlds" ? "true" : undefined} onClick={() => selectSubTab("worlds")}>Worlds</button>
              <button className={subTab === "roster" ? "active" : ""} aria-current={subTab === "roster" ? "true" : undefined} onClick={() => selectSubTab("roster")}>Roster</button>
              <button className={subTab === "codex" ? "active" : ""} aria-current={subTab === "codex" ? "true" : undefined} onClick={() => selectSubTab("codex")}>
                Codex{codexUnseen && <span className="nav-badge" aria-label="New codex activity" />}
              </button>
              <button className={subTab === "notes" ? "active" : ""} aria-current={subTab === "notes" ? "true" : undefined} onClick={() => selectSubTab("notes")}>
                Notes{notesUnseen && <span className="nav-badge" aria-label="New notes activity" />}
              </button>
              <button className={subTab === "downtime" ? "active" : ""} aria-current={subTab === "downtime" ? "true" : undefined} onClick={() => selectSubTab("downtime")}>Downtime</button>
              <button className={subTab === "gallery" ? "active" : ""} aria-current={subTab === "gallery" ? "true" : undefined} onClick={() => selectSubTab("gallery")}>Gallery</button>
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
        {subTab === "compendium" && <CompendiumPage />}
        {subTab === "billing" && <BillingPage />}
        {subTab === "overview" && <WorldOverviewPage onNavigate={navigateFromOverview} />}
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
        {subTab === "gallery" && <GalleryPage />}
        {subTab === "notes" && <SessionNotesPage onOpenInRoster={openInRoster} />}
        {subTab === "downtime" && <DowntimePage />}
        {subTab === "combat" && <CombatPage />}
        {subTab === "shop" && <ShopPage />}
        {subTab === "inventory" && <InventoryPage />}
      </main>

      <PrintPane items={printItems} />
    </div>
  );
}

export default App;

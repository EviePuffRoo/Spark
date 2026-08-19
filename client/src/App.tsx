import { useState } from "react";
import "./App.css";
import type { EntityType } from "@spark/shared";
import { useAuth } from "./AuthContext";
import { ActiveWorldProvider, useActiveWorld } from "./ActiveWorldContext";
import { useActivityBadges } from "./useActivityBadges";
import { AuthPage } from "./pages/AuthPage";
import { RecoveryCodeDisplay } from "./components/RecoveryCodeDisplay";
import { OnboardingChoice } from "./components/OnboardingChoice";
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
import { ProfilePage } from "./pages/ProfilePage";
import { CodexPage } from "./pages/CodexPage";
import { GalleryPage } from "./pages/GalleryPage";
import { ModerationPage } from "./pages/ModerationPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminStatsPage } from "./pages/AdminStatsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DowntimePage } from "./pages/DowntimePage";
import { ShopPage } from "./pages/ShopPage";
import { GlobalSearch } from "./components/GlobalSearch";
import { PrintPane, type PrintItem } from "./components/PrintPane";
import { PrepIcon, WorldIcon, PlayIcon, AccountIcon } from "./components/icons";

type Area = "prep" | "world" | "play" | "account";
type SubTab = "create" | "compendium" | "overview" | "worlds" | "roster" | "codex" | "notes" | "downtime" | "combat" | "shop" | "inventory" | "gallery" | "profile" | "myCharacter" | "billing" | "moderation" | "users" | "stats";

const AREA_LABELS: Record<Area, string> = { prep: "Prep", world: "World", play: "Play", account: "Account" };
const AREA_ICONS: Record<Area, typeof PrepIcon> = { prep: PrepIcon, world: WorldIcon, play: PlayIcon, account: AccountIcon };
const AREA_DEFAULT_SUBTAB: Record<Area, SubTab> = { prep: "create", world: "overview", play: "combat", account: "profile" };

function App() {
  const { user, loading, pendingRecoveryCode, justSignedUp, dismissOnboarding } = useAuth();
  const [landOnOverview, setLandOnOverview] = useState(false);

  if (loading) {
    return (
      <div className="app-loading">
        <img src="/favicon.svg" alt="" className="app-loading-bolt" />
        <h1>Spark</h1>
        <div className="app-loading-spinner" role="status" aria-label="Loading" />
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

  // OnboardingChoice needs setWorldId from the same ActiveWorldProvider
  // instance AppShell/PlayerCompanionView use (picking the sample world
  // there must be visible once AppShell mounts), so all three branches
  // share one provider instead of each having its own.
  return (
    <ActiveWorldProvider>
      {justSignedUp ? (
        <OnboardingChoice onDone={(overview) => { dismissOnboarding(); setLandOnOverview(overview); }} />
      ) : isPlayMode ? (
        <PlayerCompanionView />
      ) : (
        <AppShell initialLandOnOverview={landOnOverview} />
      )}
    </ActiveWorldProvider>
  );
}

function AppShell({ initialLandOnOverview = false }: { initialLandOnOverview?: boolean }) {
  const { user } = useAuth();
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const { combatUnseen, notesUnseen, codexUnseen, inventoryUnseen, markSeen } = useActivityBadges(!!user);
  // Stripe Checkout/Portal redirects land back on the bare app root — route
  // straight to the Billing tab so its own effect can refresh the tier.
  const returningFromBilling = new URLSearchParams(window.location.search).has("billing");
  const [area, setArea] = useState<Area>(returningFromBilling ? "account" : initialLandOnOverview ? "world" : "prep");
  const [subTab, setSubTab] = useState<SubTab>(returningFromBilling ? "billing" : initialLandOnOverview ? "overview" : "create");
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

  function navigateToBilling() {
    setArea("account");
    setSubTab("billing");
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
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Main navigation">
        <div className="nav-rail-brand">
          <img src="/favicon.svg" alt="" className="nav-rail-bolt" />
          <span className="nav-rail-wordmark">Spark</span>
        </div>
        <div className="nav-rail-items">
          {(Object.keys(AREA_LABELS) as Area[]).map((a) => {
            const Icon = AREA_ICONS[a];
            return (
              <button key={a} className={`nav-rail-item${area === a ? " active" : ""}`} aria-current={area === a ? "true" : undefined} onClick={() => selectArea(a)}>
                <Icon className="nav-icon" aria-hidden="true" />
                <span className="nav-rail-label">{AREA_LABELS[a]}</span>
                {a === "world" && worldAreaUnseen && <span className="nav-badge" aria-label="New world activity" />}
                {a === "play" && playAreaUnseen && <span className="nav-badge" aria-label="New play activity" />}
              </button>
            );
          })}
        </div>
      </nav>

      <nav className="area-sidebar" aria-label="Section navigation">
        {area === "prep" && (
          <>
            <button className={subTab === "create" ? "active" : ""} aria-current={subTab === "create" ? "true" : undefined} onClick={() => selectSubTab("create")}>Create</button>
            <button className={subTab === "compendium" ? "active" : ""} aria-current={subTab === "compendium" ? "true" : undefined} onClick={() => selectSubTab("compendium")}>Compendium</button>
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
        {area === "account" && (
          <>
            <button className={subTab === "profile" ? "active" : ""} aria-current={subTab === "profile" ? "true" : undefined} onClick={() => selectSubTab("profile")}>Profile</button>
            <button className={subTab === "myCharacter" ? "active" : ""} aria-current={subTab === "myCharacter" ? "true" : undefined} onClick={() => selectSubTab("myCharacter")}>My Character</button>
            <button className={subTab === "billing" ? "active" : ""} aria-current={subTab === "billing" ? "true" : undefined} onClick={() => selectSubTab("billing")}>Billing</button>
            {user?.role === "admin" && (
              <>
                <button className={subTab === "moderation" ? "active" : ""} aria-current={subTab === "moderation" ? "true" : undefined} onClick={() => selectSubTab("moderation")}>Moderation</button>
                <button className={subTab === "users" ? "active" : ""} aria-current={subTab === "users" ? "true" : undefined} onClick={() => selectSubTab("users")}>Users</button>
                <button className={subTab === "stats" ? "active" : ""} aria-current={subTab === "stats" ? "true" : undefined} onClick={() => selectSubTab("stats")}>Stats</button>
              </>
            )}
          </>
        )}
      </nav>

      <div className="app-content">
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
        </div>
        <GlobalSearch onSelect={openInRoster} />
      </header>

      <main>
        {subTab === "create" && <CreatePage />}
        {subTab === "compendium" && <CompendiumPage />}
        {subTab === "profile" && <ProfilePage />}
        {subTab === "myCharacter" && <MyCharacterPage onViewRoster={viewRosterForWorld} />}
        {subTab === "billing" && <BillingPage />}
        {subTab === "moderation" && user?.role === "admin" && <ModerationPage />}
        {subTab === "users" && user?.role === "admin" && <AdminUsersPage />}
        {subTab === "stats" && user?.role === "admin" && <AdminStatsPage />}
        {subTab === "overview" && <WorldOverviewPage onNavigate={navigateFromOverview} />}
        {subTab === "worlds" && <WorldsPage onViewRoster={viewRosterForWorld} onNavigateToBilling={navigateToBilling} />}
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
    </div>
  );
}

export default App;

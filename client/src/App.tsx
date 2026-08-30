import { lazy, Suspense, useState } from "react";
import "./App.css";
import type { EntityType, Item } from "@spark/shared";
import { useAuth } from "./AuthContext";
import { ActiveWorldProvider, useActiveWorld } from "./ActiveWorldContext";
import { useActivityBadges } from "./useActivityBadges";
import { useLocalStorage } from "./useLocalStorage";
import { AuthPage } from "./pages/AuthPage";
import { RecoveryCodeDisplay } from "./components/RecoveryCodeDisplay";
import { OnboardingChoice } from "./components/OnboardingChoice";
import type { RosterSelection } from "./pages/RosterPage";
import type { OverviewNavTarget } from "./pages/WorldOverviewPage";
import { GlobalSearch } from "./components/GlobalSearch";
import { PrintPane, type PrintItem } from "./components/PrintPane";
import { PrepIcon, WorldIcon, PlayIcon, AccountIcon } from "./components/icons";
import { GroupedTabs } from "./components/GroupedTabs";

// Every tab body below is its own chunk, not part of the initial bundle —
// a fresh visitor only ever pays for AuthPage/the shell up front, and each
// tab's code downloads the first time it's actually opened. Named exports
// need the .then(...) unwrap since React.lazy only accepts a module whose
// *default* export is the component.
const PlayerCompanionView = lazy(() => import("./pages/PlayerCompanionView").then((m) => ({ default: m.PlayerCompanionView })));
const CreatePage = lazy(() => import("./pages/CreatePage").then((m) => ({ default: m.CreatePage })));
const SessionNotesPage = lazy(() => import("./pages/SessionNotesPage").then((m) => ({ default: m.SessionNotesPage })));
const RosterPage = lazy(() => import("./pages/RosterPage").then((m) => ({ default: m.RosterPage })));
const WorldsPage = lazy(() => import("./pages/WorldsPage").then((m) => ({ default: m.WorldsPage })));
const WorldOverviewPage = lazy(() => import("./pages/WorldOverviewPage").then((m) => ({ default: m.WorldOverviewPage })));
const CombatPage = lazy(() => import("./pages/CombatPage").then((m) => ({ default: m.CombatPage })));
const MyCharacterPage = lazy(() => import("./pages/MyCharacterPage").then((m) => ({ default: m.MyCharacterPage })));
const CompendiumPage = lazy(() => import("./pages/CompendiumPage").then((m) => ({ default: m.CompendiumPage })));
const BillingPage = lazy(() => import("./pages/BillingPage").then((m) => ({ default: m.BillingPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const CodexPage = lazy(() => import("./pages/CodexPage").then((m) => ({ default: m.CodexPage })));
const GalleryPage = lazy(() => import("./pages/GalleryPage").then((m) => ({ default: m.GalleryPage })));
const ModerationPage = lazy(() => import("./pages/ModerationPage").then((m) => ({ default: m.ModerationPage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const AdminStatsPage = lazy(() => import("./pages/AdminStatsPage").then((m) => ({ default: m.AdminStatsPage })));
const InventoryPage = lazy(() => import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const DowntimePage = lazy(() => import("./pages/DowntimePage").then((m) => ({ default: m.DowntimePage })));
const ShopPage = lazy(() => import("./pages/ShopPage").then((m) => ({ default: m.ShopPage })));
const TavernPage = lazy(() => import("./pages/TavernPage").then((m) => ({ default: m.TavernPage })));
const MapBuilderPage = lazy(() => import("./pages/MapBuilderPage").then((m) => ({ default: m.MapBuilderPage })));

function TabLoading() {
  return (
    <div className="page">
      <div className="panel"><p className="hint">Loading…</p></div>
    </div>
  );
}

type Area = "prep" | "world" | "play" | "account";
type SubTab = "create" | "compendium" | "overview" | "worlds" | "roster" | "codex" | "notes" | "downtime" | "tavern" | "combat" | "mapBuilder" | "shop" | "inventory" | "gallery" | "profile" | "myCharacter" | "billing" | "moderation" | "users" | "stats";

const AREA_LABELS: Record<Area, string> = { prep: "Prep", world: "World", play: "Play", account: "Account" };
const AREA_ICONS: Record<Area, typeof PrepIcon> = { prep: PrepIcon, world: WorldIcon, play: PlayIcon, account: AccountIcon };
const AREA_DEFAULT_SUBTAB: Record<Area, SubTab> = { prep: "create", world: "overview", play: "combat", account: "profile" };
const SUBTAB_LABELS: Record<SubTab, string> = {
  create: "Create", compendium: "Compendium", overview: "Overview", worlds: "Worlds",
  roster: "Roster", codex: "Codex", notes: "Notes", downtime: "Downtime", tavern: "Tavern", combat: "Combat", mapBuilder: "Map Builder",
  shop: "Shop", inventory: "Inventory", gallery: "Gallery", profile: "Profile",
  myCharacter: "My Character", billing: "Billing", moderation: "Moderation", users: "Users", stats: "Stats",
};

// World's 7 subtabs (Gallery lives in Account — it's cross-campaign public
// content, not per-world content) grouped so the sidebar shows 3 group
// buttons instead of 7 flat ones.
type WorldSubTab = "overview" | "worlds" | "roster" | "codex" | "notes" | "downtime" | "tavern";
type WorldGroup = "campaign" | "records" | "downtime";
const WORLD_GROUPS: Record<WorldGroup, WorldSubTab[]> = {
  campaign: ["overview", "worlds"],
  records: ["roster", "codex", "notes"],
  downtime: ["downtime", "tavern"],
};
const WORLD_GROUP_LABELS: Record<WorldGroup, string> = { campaign: "Campaign", records: "Records", downtime: "Downtime" };
const WORLD_SUBTAB_TO_GROUP = Object.fromEntries(
  (Object.keys(WORLD_GROUPS) as WorldGroup[]).flatMap((g) => WORLD_GROUPS[g].map((t) => [t, g])),
) as Record<WorldSubTab, WorldGroup>;

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
        <Suspense fallback={<TabLoading />}><PlayerCompanionView /></Suspense>
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
  // Remembers the last subtab visited within each area, so switching areas
  // and back doesn't dump the DM back on that area's default screen —
  // e.g. leaving Codex for Combat and returning to World lands back on
  // Codex, not Overview. GroupedTabs' own activeGroup re-derives from
  // whatever subTab it's handed (see GroupedTabs.tsx), so remembering the
  // subtab here is enough to also restore World's active sidebar group.
  const [lastSubTabByArea, setLastSubTabByArea] = useLocalStorage<Record<Area, SubTab>>("spark-last-subtab-by-area", AREA_DEFAULT_SUBTAB);
  const [rosterWorldFilter, setRosterWorldFilter] = useState("");
  const [rosterSelection, setRosterSelection] = useState<RosterSelection | null>(null);
  const [printItems, setPrintItems] = useState<PrintItem[] | null>(null);
  const [craftedItemHandoff, setCraftedItemHandoff] = useState<{ item: Item; worldId: string } | null>(null);

  // Single source of truth for every area/subtab change — explicit args
  // rather than reading the `area`/`subTab` closures, since several call
  // sites (viewRosterForWorld, openInRoster, ...) jump across areas in one
  // gesture and a stale closure value would record the memory under the
  // wrong (pre-jump) area.
  function navigateTo(nextArea: Area, nextSubTab: SubTab) {
    setArea(nextArea);
    setSubTab(nextSubTab);
    setLastSubTabByArea((prev) => ({ ...prev, [nextArea]: nextSubTab }));
    if (nextSubTab === "codex") markSeen("codex");
    else if (nextSubTab === "notes") markSeen("notes");
    else if (nextSubTab === "combat") markSeen("combat");
    else if (nextSubTab === "inventory") markSeen("inventory");
  }

  const ADMIN_ONLY_SUBTABS: SubTab[] = ["moderation", "users", "stats"];

  function selectArea(next: Area) {
    const remembered = lastSubTabByArea[next];
    // Guards a stale localStorage value pointing at an admin-only tab for
    // an account that (now) isn't an admin — falls back to the area
    // default instead of landing on a screen with nothing rendered.
    const target = remembered && !(ADMIN_ONLY_SUBTABS.includes(remembered) && user?.role !== "admin")
      ? remembered
      : AREA_DEFAULT_SUBTAB[next];
    navigateTo(next, target);
  }

  function selectSubTab(next: SubTab) {
    navigateTo(area, next);
  }

  function viewRosterForWorld(worldIdToView: string) {
    setRosterWorldFilter(worldIdToView);
    navigateTo("world", "roster");
  }

  // A just-forged item has no downtime activity of its own yet — this
  // hands it to DowntimePage pre-selected as the thing being crafted, the
  // same "pass a target across pages" pattern viewRosterForWorld already
  // uses, just carrying an Item instead of a world filter.
  function sendToDowntimeLog(item: Item, itemWorldId: string) {
    setWorldId(itemWorldId);
    setCraftedItemHandoff({ item, worldId: itemWorldId });
    navigateTo("world", "downtime");
  }

  function navigateToBilling() {
    navigateTo("account", "billing");
  }

  function openInRoster(type: EntityType, id: string) {
    // battleMap has its own dedicated page (Map Builder), not a RosterPage
    // tab — Map Builder doesn't support deep-linking to one specific map
    // yet, but landing there is still correct, unlike RosterPage which has
    // no tab for this type at all.
    if (type === "battleMap") {
      navigateTo("play", "mapBuilder");
      return;
    }
    setRosterSelection({ type, id });
    navigateTo("world", "roster");
  }

  function navigateFromOverview(target: OverviewNavTarget) {
    navigateTo(target === "shop" ? "play" : "world", target);
  }

  function navigateFromSearch(nextArea: Area, nextSubTab: SubTab) {
    navigateTo(nextArea, nextSubTab);
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
          <GroupedTabs
            className="area-sidebar-grouped-tabs"
            groups={WORLD_GROUPS}
            groupLabels={WORLD_GROUP_LABELS}
            itemLabels={SUBTAB_LABELS}
            groupOf={(t) => WORLD_SUBTAB_TO_GROUP[t]}
            active={subTab as WorldSubTab}
            onSelect={(t) => selectSubTab(t)}
            itemBadge={(t) =>
              (t === "codex" && codexUnseen) || (t === "notes" && notesUnseen)
                ? <span className="nav-badge" aria-label="New activity" />
                : null
            }
          />
        )}
        {area === "play" && (
          <>
            <button className={subTab === "combat" ? "active" : ""} aria-current={subTab === "combat" ? "true" : undefined} onClick={() => selectSubTab("combat")}>
              Combat{combatUnseen && <span className="nav-badge" aria-label="New combat activity" />}
            </button>
            <button className={subTab === "mapBuilder" ? "active" : ""} aria-current={subTab === "mapBuilder" ? "true" : undefined} onClick={() => selectSubTab("mapBuilder")}>Map Builder</button>
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
            <button className={subTab === "gallery" ? "active" : ""} aria-current={subTab === "gallery" ? "true" : undefined} onClick={() => selectSubTab("gallery")}>Gallery</button>
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
        <GlobalSearch onSelect={openInRoster} onNavigate={navigateFromSearch} />
      </header>

      <main>
        <h1 className="sr-only">Spark: {SUBTAB_LABELS[subTab]}</h1>
        <Suspense fallback={<TabLoading />}>
          {subTab === "create" && <CreatePage onSendToDowntime={sendToDowntimeLog} />}
          {subTab === "compendium" && <CompendiumPage />}
          {subTab === "profile" && <ProfilePage onNavigateToBilling={navigateToBilling} />}
          {subTab === "myCharacter" && <MyCharacterPage onViewRoster={viewRosterForWorld} onPrint={setPrintItems} />}
          {subTab === "billing" && <BillingPage />}
          {subTab === "gallery" && <GalleryPage />}
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
          {subTab === "notes" && <SessionNotesPage onOpenInRoster={openInRoster} />}
          {subTab === "downtime" && (
            <DowntimePage craftedItemHandoff={craftedItemHandoff} onConsumeCraftedItemHandoff={() => setCraftedItemHandoff(null)} />
          )}
          {subTab === "tavern" && <TavernPage onNavigateToBilling={navigateToBilling} />}
          {subTab === "combat" && <CombatPage />}
          {subTab === "mapBuilder" && <MapBuilderPage />}
          {subTab === "shop" && <ShopPage />}
          {subTab === "inventory" && <InventoryPage />}
        </Suspense>
      </main>

      <PrintPane items={printItems} />
      </div>
    </div>
  );
}

export default App;

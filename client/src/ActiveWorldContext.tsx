import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type WorldSummary } from "./api";
import { useLocalStorage } from "./useLocalStorage";

interface ActiveWorldContextValue {
  worlds: WorldSummary[];
  worldId: string;
  setWorldId: (worldId: string) => void;
  refreshWorlds: () => void;
  loading: boolean;
}

const ActiveWorldContext = createContext<ActiveWorldContextValue | null>(null);

export function ActiveWorldProvider({ children }: { children: ReactNode }) {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [worldId, setWorldId] = useLocalStorage("spark-active-world-id", "");
  // Starts true so consumers (e.g. PlayerCompanionView's "not in any worlds"
  // empty state) can tell "still fetching" apart from "confirmed zero worlds"
  // on first mount — never reset once the first fetch lands.
  const [loading, setLoading] = useState(true);

  function refreshWorlds() {
    api.listWorlds().then(setWorlds).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(refreshWorlds, []);

  return (
    <ActiveWorldContext.Provider value={{ worlds, worldId, setWorldId, refreshWorlds, loading }}>
      {children}
    </ActiveWorldContext.Provider>
  );
}

export function useActiveWorld(): ActiveWorldContextValue {
  const ctx = useContext(ActiveWorldContext);
  if (!ctx) throw new Error("useActiveWorld must be used within an ActiveWorldProvider");
  return ctx;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type WorldSummary } from "./api";
import { useLocalStorage } from "./useLocalStorage";

interface ActiveWorldContextValue {
  worlds: WorldSummary[];
  worldId: string;
  setWorldId: (worldId: string) => void;
  refreshWorlds: () => void;
}

const ActiveWorldContext = createContext<ActiveWorldContextValue | null>(null);

export function ActiveWorldProvider({ children }: { children: ReactNode }) {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [worldId, setWorldId] = useLocalStorage("spark-active-world-id", "");

  function refreshWorlds() {
    api.listWorlds().then(setWorlds).catch(() => {});
  }

  useEffect(refreshWorlds, []);

  return (
    <ActiveWorldContext.Provider value={{ worlds, worldId, setWorldId, refreshWorlds }}>
      {children}
    </ActiveWorldContext.Provider>
  );
}

export function useActiveWorld(): ActiveWorldContextValue {
  const ctx = useContext(ActiveWorldContext);
  if (!ctx) throw new Error("useActiveWorld must be used within an ActiveWorldProvider");
  return ctx;
}

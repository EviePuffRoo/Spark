import { useEffect, useState } from "react";
import { api } from "./api";
import { useLocalStorage } from "./useLocalStorage";

const POLL_INTERVAL_MS = 20000;

export function useActivityBadges() {
  const [lastSeenCombat, setLastSeenCombat] = useLocalStorage<string>("spark-last-seen-combat", "");
  const [lastSeenNotes, setLastSeenNotes] = useLocalStorage<string>("spark-last-seen-notes", "");
  const [combatActivityAt, setCombatActivityAt] = useState<string | null>(null);
  const [notesActivityAt, setNotesActivityAt] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      api.getActivity().then((summary) => {
        setCombatActivityAt(summary.combatActivityAt);
        setNotesActivityAt(summary.notesActivityAt);
      }).catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function markSeen(tab: "combat" | "notes") {
    const now = new Date().toISOString();
    if (tab === "combat") setLastSeenCombat(now);
    else setLastSeenNotes(now);
  }

  const combatUnseen = !!combatActivityAt && (!lastSeenCombat || combatActivityAt > lastSeenCombat);
  const notesUnseen = !!notesActivityAt && (!lastSeenNotes || notesActivityAt > lastSeenNotes);

  return { combatUnseen, notesUnseen, markSeen };
}

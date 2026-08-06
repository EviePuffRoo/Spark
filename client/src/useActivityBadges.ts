import { useEffect, useState } from "react";
import { api } from "./api";
import { useLocalStorage } from "./useLocalStorage";

const POLL_INTERVAL_MS = 20000;

export function useActivityBadges() {
  const [lastSeenCombat, setLastSeenCombat] = useLocalStorage<string>("spark-last-seen-combat", "");
  const [lastSeenNotes, setLastSeenNotes] = useLocalStorage<string>("spark-last-seen-notes", "");
  const [lastSeenCodex, setLastSeenCodex] = useLocalStorage<string>("spark-last-seen-codex", "");
  const [combatActivityAt, setCombatActivityAt] = useState<string | null>(null);
  const [notesActivityAt, setNotesActivityAt] = useState<string | null>(null);
  const [codexActivityAt, setCodexActivityAt] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      api.getActivity().then((summary) => {
        setCombatActivityAt(summary.combatActivityAt);
        setNotesActivityAt(summary.notesActivityAt);
        setCodexActivityAt(summary.codexActivityAt);
      }).catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function markSeen(tab: "combat" | "notes" | "codex") {
    const now = new Date().toISOString();
    if (tab === "combat") setLastSeenCombat(now);
    else if (tab === "notes") setLastSeenNotes(now);
    else setLastSeenCodex(now);
  }

  const combatUnseen = !!combatActivityAt && (!lastSeenCombat || combatActivityAt > lastSeenCombat);
  const notesUnseen = !!notesActivityAt && (!lastSeenNotes || notesActivityAt > lastSeenNotes);
  const codexUnseen = !!codexActivityAt && (!lastSeenCodex || codexActivityAt > lastSeenCodex);

  return { combatUnseen, notesUnseen, codexUnseen, markSeen };
}

import { useEffect, useState } from "react";
import { api } from "./api";
import { useLocalStorage } from "./useLocalStorage";

const POLL_INTERVAL_MS = 20000;

export function useActivityBadges() {
  const [lastSeenCombat, setLastSeenCombat] = useLocalStorage<string>("spark-last-seen-combat", "");
  const [lastSeenNotes, setLastSeenNotes] = useLocalStorage<string>("spark-last-seen-notes", "");
  const [lastSeenInventory, setLastSeenInventory] = useLocalStorage<string>("spark-last-seen-inventory", "");
  const [combatActivityAt, setCombatActivityAt] = useState<string | null>(null);
  const [notesActivityAt, setNotesActivityAt] = useState<string | null>(null);
  const [inventoryActivityAt, setInventoryActivityAt] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      api.getActivity().then((summary) => {
        setCombatActivityAt(summary.combatActivityAt);
        setNotesActivityAt(summary.notesActivityAt);
        setInventoryActivityAt(summary.inventoryActivityAt);
      }).catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function markSeen(tab: "combat" | "notes" | "inventory") {
    const now = new Date().toISOString();
    if (tab === "combat") setLastSeenCombat(now);
    else if (tab === "notes") setLastSeenNotes(now);
    else setLastSeenInventory(now);
  }

  const combatUnseen = !!combatActivityAt && (!lastSeenCombat || combatActivityAt > lastSeenCombat);
  const notesUnseen = !!notesActivityAt && (!lastSeenNotes || notesActivityAt > lastSeenNotes);
  const inventoryUnseen = !!inventoryActivityAt && (!lastSeenInventory || inventoryActivityAt > lastSeenInventory);

  return { combatUnseen, notesUnseen, inventoryUnseen, markSeen };
}

import { useEffect, type RefObject } from "react";

// On the master-detail pages (Roster/Codex/Compendium), the detail panel
// sits beside the list on desktop but stacks below it once the layout
// collapses at the same breakpoint App.css already uses for .roster-layout
// — on a long list, selecting an entry gives no visible feedback unless the
// user scrolls all the way past the rest of the list to find it. Desktop is
// untouched: both panels are already visible there, so auto-scrolling would
// just be an unwanted jump.
export function useScrollDetailOnSelect(detailRef: RefObject<HTMLElement | null>, selectedId: string | null) {
  useEffect(() => {
    if (!selectedId) return;
    if (!window.matchMedia("(max-width: 800px)").matches) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // detailRef is a stable ref object; only selectedId should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
}

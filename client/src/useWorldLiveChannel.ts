import { useEffect, useRef, useState } from "react";
import type { Encounter, LedgerSummary, RollLogEntry, ChatMessage, TokenMovedBroadcast } from "@spark/shared";
import { api } from "./api";

interface WorldLiveOptions {
  onEncounter?: (encounter: Encounter) => void;
  onLedger?: (summary: LedgerSummary) => void;
  onRollLog?: (rows: RollLogEntry[]) => void;
  onChat?: (messages: ChatMessage[]) => void;
  // Unlike the four above, this one has no REST counterpart to resync
  // from on (re)connect — it's a pure, unpersisted push of an in-progress
  // token drag (see worldEvents.ts's publishTokenMoved), so the handler
  // just applies the tiny payload directly instead of triggering a fetch.
  onTokenMoved?: (payload: TokenMovedBroadcast) => void;
}

// Replaces the app's old per-page 5s polling loops with one pushed SSE
// connection per world. The server only signals "something changed" (see
// server/src/worldEvents.ts) — this hook does a REST resync on every
// connect/reconnect (`onopen` fires for both) rather than trusting the
// stream to have caught every intermediate state, which keeps the
// server-side redaction logic (per-viewer, already applied by the REST
// endpoints) as the single source of truth instead of duplicating it here.
export function useWorldLiveChannel(worldId: string | null | undefined, options: WorldLiveOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!worldId) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    setError(null);

    const es = new EventSource(`/api/worlds/${worldId}/live`);

    es.onopen = () => {
      if (cancelled) return;
      setConnected(true);
      setError(null);
      const opts = optionsRef.current;
      if (opts.onEncounter) api.getEncounter(worldId).then((e) => { if (!cancelled) opts.onEncounter?.(e); }).catch(() => {});
      if (opts.onLedger) api.getLedger(worldId).then((s) => { if (!cancelled) opts.onLedger?.(s); }).catch(() => {});
      if (opts.onRollLog) api.listRollLog(worldId).then((r) => { if (!cancelled) opts.onRollLog?.(r); }).catch(() => {});
      if (opts.onChat) api.listChat(worldId).then((c) => { if (!cancelled) opts.onChat?.(c); }).catch(() => {});
    };

    es.onerror = () => {
      if (cancelled) return;
      setConnected(false);
      // A closed readyState means the browser gave up (e.g. the server
      // rejected the connection, like a 403 for lost world access) — a real,
      // user-facing failure. Any other state is a transient network drop
      // that EventSource will keep retrying on its own; not worth surfacing
      // as an error, just as "not currently connected".
      if (es.readyState === EventSource.CLOSED) {
        setError("Lost access to this world's live updates.");
      }
    };

    es.addEventListener("encounter", (ev) => {
      if (cancelled) return;
      optionsRef.current.onEncounter?.(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("ledger", (ev) => {
      if (cancelled) return;
      optionsRef.current.onLedger?.(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("rollLog", (ev) => {
      if (cancelled) return;
      optionsRef.current.onRollLog?.(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("chat", (ev) => {
      if (cancelled) return;
      optionsRef.current.onChat?.(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("tokenMoved", (ev) => {
      if (cancelled) return;
      optionsRef.current.onTokenMoved?.(JSON.parse((ev as MessageEvent).data));
    });

    return () => {
      cancelled = true;
      es.close();
    };
  }, [worldId]);

  return { connected, error };
}

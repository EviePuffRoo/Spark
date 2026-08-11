import { useEffect, useRef } from "react";
import type { Encounter } from "@spark/shared";

// Synthesizes a short beep instead of shipping an audio asset — avoids any
// licensing/binary-asset question for a one-off UI cue.
function playChime() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext unavailable/blocked — skip the audio cue silently.
  }
}

// Fires an in-tab notification + chime the moment the live turn order
// transitions onto one of the signed-in player's own characters. Tracks the
// previously-active combatant id to detect a genuine transition rather than
// re-firing on every SSE push — useWorldLiveChannel resyncs via REST on every
// reconnect, which would otherwise re-notify for a turn that never changed.
export function useMyTurnNotifier(encounter: Encounter | null, myPlayerCharacterIds: string[], enabled: boolean) {
  const lastActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!encounter || encounter.combatants.length === 0) {
      lastActiveIdRef.current = null;
      return;
    }

    const sorted = [...encounter.combatants].sort((a, b) => b.initiative - a.initiative);
    const active = sorted[encounter.turnIndex % sorted.length] ?? null;
    const activeId = active?.id ?? null;

    const isNewTurn = activeId !== lastActiveIdRef.current;
    lastActiveIdRef.current = activeId;

    if (!isNewTurn || !enabled || !active?.playerCharacterId) return;
    if (!myPlayerCharacterIds.includes(active.playerCharacterId)) return;

    playChime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Your turn!", { body: active.name });
    }
  }, [encounter, myPlayerCharacterIds, enabled]);
}

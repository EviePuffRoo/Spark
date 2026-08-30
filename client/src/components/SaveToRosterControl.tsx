import { useState, type ReactNode } from "react";
import type { WorldSummary } from "../api";
import { SaveEntityFields } from "./SaveEntityFields";

export interface SaveToRosterFields {
  worldId: string | null;
  tags: string[];
  notes?: string;
  hiddenFromParty: boolean;
}

// One-click save for every Forge/Create page. The primary button always
// saves immediately with today's defaults (active world or Unassigned, no
// tags, no notes, visible) — RosterPage already lets a DM revise all four
// fields non-lossy after the fact, so nothing is lost by not asking up
// front. "Customize before saving" is additive for a DM who wants those
// set before the entity is party-visible; it's never required to save.
export function SaveToRosterControl({
  worlds, defaultWorldId, onSave, saveLabel, savedLabel, tagsPlaceholder, notesPlaceholder,
  extraActions, extraFields,
}: {
  worlds: WorldSummary[];
  defaultWorldId: string;
  onSave: (fields: SaveToRosterFields) => Promise<void>;
  saveLabel: string;
  savedLabel: string;
  tagsPlaceholder?: string;
  notesPlaceholder?: string;
  // Rare pages (e.g. Item Forge's "Save & Send to Downtime Log") offer a
  // second save action that shares the same fields as the primary one.
  extraActions?: {
    label: string;
    onSave: (fields: SaveToRosterFields) => Promise<void>;
    show?: (fields: SaveToRosterFields) => boolean;
  }[];
  // Rare pages (e.g. Settlement Forge's "anchor to a Region" picker) have
  // one extra field beyond the standard four. It renders alongside
  // SaveEntityFields under "Customize before saving"; the page owns its
  // own state for it and reads that state in its onSave callback.
  extraFields?: ReactNode;
}) {
  const [customizing, setCustomizing] = useState(false);
  const [worldId, setWorldId] = useState(defaultWorldId);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [hiddenFromParty, setHiddenFromParty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const currentFields: SaveToRosterFields = {
    worldId: worldId || null,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    notes: notes || undefined,
    hiddenFromParty,
  };

  async function handleSave(action: (fields: SaveToRosterFields) => Promise<void>) {
    setStatus("saving");
    setError(null);
    try {
      await action(currentFields);
      setStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  if (status === "saved") {
    return <p className="success">{savedLabel}</p>;
  }

  return (
    <div className="save-panel save-to-roster-control">
      {customizing && (
        <>
          {extraFields}
          <SaveEntityFields
            worlds={worlds} worldId={worldId} setWorldId={setWorldId}
            tags={tags} setTags={setTags} tagsPlaceholder={tagsPlaceholder}
            notes={notes} setNotes={setNotes} notesPlaceholder={notesPlaceholder}
            hiddenFromParty={hiddenFromParty} setHiddenFromParty={setHiddenFromParty}
          />
        </>
      )}
      <div className="save-to-roster-actions">
        <button className="btn-primary" onClick={() => handleSave(onSave)} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : saveLabel}
        </button>
        {extraActions?.filter((a) => !a.show || a.show(currentFields)).map((a) => (
          <button key={a.label} className="btn-secondary" onClick={() => handleSave(a.onSave)} disabled={status === "saving"}>
            {a.label}
          </button>
        ))}
        {!customizing && (
          <button type="button" className="link-button" onClick={() => setCustomizing(true)}>
            Customize before saving
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

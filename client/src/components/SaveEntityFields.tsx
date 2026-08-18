import type { WorldSummary } from "../api";

// The World / Tags / Notes / Hidden-from-party block every Create/Forge
// page's save panel shows before writing a generated (or hand-built) entity
// to the Roster. Pulled out once so "Hidden from party" — otherwise easy to
// forget entirely, since it previously only existed on Roster's post-save
// edit screen — shows up consistently at the one moment it actually matters:
// before the entity is saved and immediately party-visible by default.
export function SaveEntityFields({
  worlds, worldId, setWorldId, tags, setTags, tagsPlaceholder, notes, setNotes, notesPlaceholder,
  hiddenFromParty, setHiddenFromParty,
}: {
  worlds: WorldSummary[];
  worldId: string;
  setWorldId: (id: string) => void;
  tags: string;
  setTags: (tags: string) => void;
  tagsPlaceholder?: string;
  notes: string;
  setNotes: (notes: string) => void;
  notesPlaceholder?: string;
  hiddenFromParty: boolean;
  setHiddenFromParty: (hidden: boolean) => void;
}) {
  return (
    <>
      <label className="field">
        <span>World (optional)</span>
        <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
          <option value="">Unassigned</option>
          {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Tags (comma separated)</span>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tagsPlaceholder} />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={notesPlaceholder} />
      </label>
      <label className="field">
        <input type="checkbox" checked={hiddenFromParty} onChange={(e) => setHiddenFromParty(e.target.checked)} />
        {" "}Hidden from party
      </label>
      <p className="hint save-visibility-hint">
        {hiddenFromParty ? "Only you can see this until you reveal it." : "Visible to your party as soon as it's saved."}
      </p>
    </>
  );
}

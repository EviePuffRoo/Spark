import { useEffect, useState } from "react";
import type { GenerateItemRequest, GeneratedItem, Item } from "@spark/shared";
import { ITEM_RARITY_TIER_INFO, computeCraftingCost } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { ItemCardView } from "../components/ItemCardView";
import { ItemEditor } from "../components/ItemEditor";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const TIER_0 = ITEM_RARITY_TIER_INFO[0];
const BLANK_ITEM: GeneratedItem = {
  name: "", itemType: "", category: "", rarity: TIER_0.label, rarityTier: 0, description: "", property: "", history: "",
  bonusType: "none", bonusValue: 0, requiresAttunement: false, charges: null, rechargeRule: null,
  value: Math.round((TIER_0.valueRange[0] + TIER_0.valueRange[1]) / 2),
};

export function ItemForgePage({ onSendToDowntime }: { onSendToDowntime?: (item: Item, worldId: string) => void }) {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateItemRequest>({});
  const [quantity, setQuantity] = useState<number | "">(1);
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [manualResult, setManualResult] = useState<GeneratedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

  function switchMode(next: "generate" | "manual") {
    setCreationMode(next);
    setResults([]);
    setEditingIndex(null);
    setManualResult(null);
    setSaveGeneration((g) => g + 1);
  }

  async function handleGenerate() {
    const qty = Math.min(10, Math.max(1, Number(quantity) || 1));
    setLoading(true);
    setError(null);
    setEditingIndex(null);
    setSaveGeneration((g) => g + 1);
    try {
      const generated = await Promise.all(Array.from({ length: qty }, () => api.generateItem(form)));
      setResults(generated);
      setQuantity(qty);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function removeResult(index: number) {
    setResults(results.filter((_, i) => i !== index));
    setEditingIndex(null);
  }

  function updateResult(index: number, patch: GeneratedItem) {
    setResults(results.map((r, i) => (i === index ? patch : r)));
    setEditingIndex(null);
  }

  async function handleSaveAll(fields: SaveToRosterFields) {
    if (results.length === 0) return;
    await Promise.all(results.map((r) => api.saveItem({ ...r, ...fields })));
  }

  async function handleSaveManual(fields: SaveToRosterFields) {
    if (!manualResult) return;
    await api.saveItem({ ...manualResult, ...fields });
  }

  async function handleSaveManualAndSendToDowntime(fields: SaveToRosterFields) {
    if (!manualResult) return;
    const saved = await api.saveItem({ ...manualResult, ...fields });
    if (fields.worldId) onSendToDowntime?.(saved, fields.worldId);
  }

  const fullyRandom = !!form.fullyRandom;

  const batchResultPanel = (
    <div className="panel result-panel">
      {results.length === 0 && <p className="hint">Forge an item to see it here.</p>}
      {results.length > 0 && (
        <>
          {results.map((item, index) => (
            <div className="batch-result-card" key={index}>
              {editingIndex === index ? (
                <ItemEditor
                  value={item}
                  onSave={async (patch) => updateResult(index, patch)}
                  onCancel={() => setEditingIndex(null)}
                  saveLabel="Save Changes"
                />
              ) : (
                <>
                  <ItemCardView item={item} />
                  <p className="hint">
                    Craft it yourself: {computeCraftingCost(item).goldCost} gp, {computeCraftingCost(item).daysRequired}d
                  </p>
                  <div className="batch-result-actions">
                    <button className="btn-secondary" onClick={() => setEditingIndex(index)}>Edit</button>
                    {results.length > 1 && (
                      <button className="btn-danger" onClick={() => removeResult(index)} aria-label={`Remove ${item.name} from batch`}>Remove from batch</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {editingIndex === null && (
            <SaveToRosterControl
              key={saveGeneration}
              worlds={worlds} defaultWorldId={worldId} onSave={handleSaveAll}
              saveLabel={results.length > 1 ? `Save All ${results.length} to Roster` : "Save to Roster"}
              savedLabel={`Saved ${results.length > 1 ? `all ${results.length}` : "it"} to roster.`}
              tagsPlaceholder="quest reward, cursed, market find"
              notesPlaceholder="Where and how you plan to use it…"
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={creationMode === "generate" ? "active" : ""} aria-current={creationMode === "generate" ? "true" : undefined} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} aria-current={creationMode === "manual" ? "true" : undefined} onClick={() => switchMode("manual")}>Create Your Own</button>
      </div>

      {creationMode === "generate" && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Forge an Item</h2>
            <p className="hint">Unique, flavorful gear. Nothing game-breaking, just something worth remembering.</p>

            <label className="field">
              <input
                type="checkbox"
                checked={fullyRandom}
                onChange={(e) => setForm({ fullyRandom: e.target.checked })}
              />
              {" "}Surprise me completely
            </label>

            <fieldset disabled={fullyRandom} className="fieldset">
              <label className="field">
                <span>Category</span>
                <select value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.itemCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Rarity</span>
                <select value={form.rarity ?? ""} onChange={(e) => setForm({ ...form, rarity: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.itemRarities.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  placeholder="Random"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value || undefined })}
                />
              </label>
            </fieldset>

            <label className="field">
              <span>Quantity</span>
              <input
                type="number" min={1} max={10} value={quantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  setQuantity(raw === "" ? "" : Number(raw));
                }}
                onBlur={() => setQuantity((q) => Math.min(10, Math.max(1, Number(q) || 1)))}
              />
            </label>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Forging…" : Number(quantity) > 1 ? `Forge ${quantity}` : "Forge Item"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {batchResultPanel}
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Create Your Own Item</h2>
          <p className="hint">Write it exactly how you want it. Nothing generated, all yours.</p>
          <ItemEditor value={BLANK_ITEM} onSave={async (draft) => setManualResult(draft)} onCancel={() => switchMode("generate")} saveLabel="Continue" />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Create Your Own Item</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={() => setManualResult(null)}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <ItemCardView item={manualResult} />
            <p className="hint">
              Craft it yourself: {computeCraftingCost(manualResult).goldCost} gp, {computeCraftingCost(manualResult).daysRequired}d
            </p>

            <SaveToRosterControl
              worlds={worlds} defaultWorldId={worldId} onSave={handleSaveManual}
              saveLabel="Save to Roster" savedLabel="Saved to roster."
              tagsPlaceholder="quest reward, cursed, market find"
              notesPlaceholder="Where and how you plan to use it…"
              extraActions={[{
                label: "Save & Send to Downtime Log",
                onSave: handleSaveManualAndSendToDowntime,
                show: (fields) => !!fields.worldId,
              }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

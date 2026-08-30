import { useEffect, useState } from "react";
import type { ShopInput, GenerateShopRequest, GeneratedShop } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { ShopCardView } from "../components/ShopCardView";
import { ShopEditor } from "../components/ShopEditor";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const BLANK_SHOP: ShopInput = { name: "", stock: [] };

function toPreviewShop(input: ShopInput) {
  return { ...input, id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "" };
}

export function ShopCreatePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateShopRequest>({});
  const [generated, setGenerated] = useState<GeneratedShop | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<ShopInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

  function switchMode(next: "generate" | "manual") {
    setCreationMode(next);
    startOver();
  }

  function startOver() {
    setGenerated(null);
    setManualResult(null);
    setResetKey((k) => k + 1);
    setSaveGeneration((g) => g + 1);
    setError(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveGeneration((g) => g + 1);
    try {
      setGenerated(await api.generateShop(form));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const result = creationMode === "generate" ? generated : manualResult;

  async function handleSave(fields: SaveToRosterFields) {
    if (!result) return;
    await api.saveShop({ ...result, ...fields });
  }

  const fullyRandom = !!form.fullyRandom;

  const savePanel = (
    <>
      <SaveToRosterControl
        key={saveGeneration}
        worlds={worlds} defaultWorldId={worldId} onSave={handleSave}
        saveLabel="Save to Roster" savedLabel="Saved to roster."
        tagsPlaceholder="general-store, act-1"
      />
      {error && <p className="error">{error}</p>}
    </>
  );

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={creationMode === "generate" ? "active" : ""} aria-current={creationMode === "generate" ? "true" : undefined} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} aria-current={creationMode === "manual" ? "true" : undefined} onClick={() => switchMode("manual")}>Build Your Own</button>
      </div>

      {creationMode === "generate" && !generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Shop</h2>
            <p className="hint">A stocked, ready-to-use shop with prices already set.</p>

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
                <span>Shop type</span>
                <select value={form.archetype ?? ""} onChange={(e) => setForm({ ...form, archetype: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.shopArchetypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Stock size</span>
                <input
                  type="number" min={1} max={20}
                  value={form.stockSize ?? 8}
                  onChange={(e) => setForm({ ...form, stockSize: Number(e.target.value) })}
                />
              </label>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Stocking…" : "Generate Shop"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <p className="hint">Generate a shop to see it here.</p>
          </div>
        </div>
      )}

      {creationMode === "generate" && generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Shop</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Generate Again</button>
          </div>
          <div className="panel result-panel">
            <ShopCardView shop={toPreviewShop(generated)} />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Build a Shop</h2>
          <p className="hint">Stock it with items from your roster and set prices.</p>
          <ShopEditor
            key={resetKey}
            value={BLANK_SHOP}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Build a Shop</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <ShopCardView shop={toPreviewShop(manualResult)} />
            {savePanel}
          </div>
        </div>
      )}
    </div>
  );
}

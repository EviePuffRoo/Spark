import type { ZoneMapTemplate } from "@spark/shared";

export function ZoneMapTemplateCardView({ template }: { template: ZoneMapTemplate }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{template.name}</h2>
      <p className="statblock-subtitle">{template.zones.length} zone{template.zones.length === 1 ? "" : "s"}</p>
      <hr className="rule gold" />

      <div className="chip-row">
        {template.zones.map((zone) => (
          <span key={zone.id} className="chip">{zone.name}</span>
        ))}
      </div>

      <p className="hint">Load this template from the Zone Map in Combat to drop these zones and connections into an encounter.</p>
    </div>
  );
}

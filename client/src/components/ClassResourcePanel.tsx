import type { ClassResource } from "@spark/shared";

export function ClassResourcePanel({
  resource, onChange,
}: {
  resource: ClassResource | undefined;
  onChange?: (resource: ClassResource) => void;
}) {
  if (!resource) return null;

  function adjust(sign: 1 | -1) {
    if (!resource) return;
    onChange?.({ ...resource, current: Math.max(0, Math.min(resource.max, resource.current + sign)) });
  }

  return (
    <div className="class-resource-panel">
      <h3 className="section-heading">{resource.name}</h3>
      {onChange ? (
        <div className="button-row">
          <button type="button" className="btn-secondary" onClick={() => adjust(-1)} disabled={resource.current <= 0} aria-label={`Use a ${resource.name}`}>− Use</button>
          <span className="class-resource-value mono">{resource.current} / {resource.max}</span>
          <button type="button" className="btn-secondary" onClick={() => adjust(1)} disabled={resource.current >= resource.max} aria-label={`Restore a ${resource.name}`}>+ Restore</button>
        </div>
      ) : (
        <p>{resource.current} / {resource.max}</p>
      )}
    </div>
  );
}

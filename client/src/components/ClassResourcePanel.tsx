import type { ClassResource } from "@spark/shared";

export function ClassResourcePanel({
  resource, onChange,
}: {
  resource: ClassResource | undefined;
  onChange?: (resource: ClassResource) => void;
}) {
  if (!resource) return null;

  function setCurrent(current: number) {
    if (!resource) return;
    onChange?.({ ...resource, current: Math.max(0, Math.min(resource.max, current)) });
  }

  return (
    <div className="class-resource-panel">
      <h3 className="section-heading">{resource.name}</h3>
      {onChange ? (
        <input type="number" min={0} max={resource.max} value={resource.current} onChange={(e) => setCurrent(Number(e.target.value))} />
      ) : (
        <p>{resource.current} / {resource.max}</p>
      )}
    </div>
  );
}

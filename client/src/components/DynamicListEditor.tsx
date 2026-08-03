interface FieldConfig<T> {
  key: keyof T;
  label: string;
  multiline?: boolean;
}

export function DynamicListEditor<T extends Record<string, string>>({
  items, onChange, fields, addLabel, emptyItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  fields: FieldConfig<T>[];
  addLabel: string;
  emptyItem: T;
}) {
  function updateItem(index: number, key: keyof T, value: string) {
    const next = items.slice();
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { ...emptyItem }]);
  }

  return (
    <div className="dynamic-list-editor">
      {items.map((item, index) => (
        <div className="dynamic-list-row" key={index}>
          {fields.map((f) => (
            <label className="field" key={String(f.key)}>
              <span>{f.label}</span>
              {f.multiline ? (
                <textarea
                  rows={2}
                  value={item[f.key] as string}
                  onChange={(e) => updateItem(index, f.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={item[f.key] as string}
                  onChange={(e) => updateItem(index, f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          <button className="btn-danger" onClick={() => removeItem(index)}>Remove</button>
        </div>
      ))}
      <button className="btn-secondary" onClick={addItem}>{addLabel}</button>
    </div>
  );
}

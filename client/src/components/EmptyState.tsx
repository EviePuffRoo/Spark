import type { ReactNode } from "react";

export function EmptyState({
  icon, heading, hint, action,
}: {
  icon: ReactNode;
  heading: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{heading}</h3>
      <p className="hint">{hint}</p>
      {action}
    </div>
  );
}

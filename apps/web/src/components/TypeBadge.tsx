import { TYPE_COLORS } from "../data/types";

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLORS[type] ?? "#888" }}>
      {type}
    </span>
  );
}
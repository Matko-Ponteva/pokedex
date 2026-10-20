import { TYPE_COLORS, TYPES } from "../data/types";

type Props = {
  selected: string | null;
  onSelect: (type: string | null) => void;
};

export function TypeFilter({ selected, onSelect }: Props) {
  return (
    <div className="type-filter">
      {TYPES.map((type) => {
        const active = type === selected;
        return (
          <button
            key={type}
            type="button"
            className={active ? "type-chip active" : "type-chip"}
            style={active ? { backgroundColor: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] } : undefined}
            aria-pressed={active}
            onClick={() => onSelect(active ? null : type)}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
import { POKEMON_TYPES, type PokemonType } from "@pokedex/shared";
import { TYPE_COLORS } from "../data/types";

type Props = {
  selected: PokemonType | null;
  onSelect: (type: PokemonType | null) => void;
};

export function TypeFilter({ selected, onSelect }: Props) {
  return (
    <div className="type-filter">
      {POKEMON_TYPES.map((type) => {
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
import type { PokemonType } from "@pokedex/shared";
import { TYPE_COLORS } from "../data/types";

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLORS[type] }}>
      {type}
    </span>
  );
}
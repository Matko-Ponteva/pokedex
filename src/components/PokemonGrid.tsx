import type { PokemonListItem } from "../api/pokemon";
import { PokemonCard } from "./PokemonCard";

export function PokemonGrid({ items }: { items: PokemonListItem[] }) {
  return (
    <ul className="grid">
      {items.map((p) => (
        <PokemonCard key={p.name} pokemon={p} />
      ))}
    </ul>
  );
}
import type { PokemonSummary } from "@pokedex/shared";
import { PokemonCard } from "./PokemonCard";

export function PokemonGrid({ items }: { items: PokemonSummary[] }) {
  return (
    <ul className="grid">
      {items.map((p) => (
        <PokemonCard key={p.id} pokemon={p} />
      ))}
    </ul>
  );
}
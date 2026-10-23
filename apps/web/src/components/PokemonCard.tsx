import { Link } from "react-router";
import type { PokemonSummary } from "@pokedex/shared";
import { TypeBadge } from "./TypeBadge";

export function PokemonCard({ pokemon }: { pokemon: PokemonSummary }) {
  return (
    <li>
      <Link to={`/pokemon/${pokemon.id}`} className="card">
        <img src={pokemon.spriteUrl} alt={pokemon.name} width={96} height={96} loading="lazy" />
        <span className="number">#{String(pokemon.id).padStart(3, "0")}</span>
        <span className="name">{pokemon.name}</span>
        <div className="card-types">
          {pokemon.types.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>
      </Link>
    </li>
  );
}
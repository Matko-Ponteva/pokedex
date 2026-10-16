import { getIdFromUrl, getSpriteUrl, type PokemonListItem } from "../api/pokemon";

type Props = { pokemon: PokemonListItem };

export function PokemonCard({ pokemon }: Props) {
    const id = getIdFromUrl(pokemon.url);

    return (
    <li className="card">
      <img src={getSpriteUrl(id)} alt={pokemon.name} width={96} height={96} />
      <span className="number">#{String(id).padStart(3, "0")}</span>
      <span className="name">{pokemon.name}</span>
    </li>
  );
}
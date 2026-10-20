import { Link, useParams } from "react-router";
import { getArtworkUrl } from "../api/pokemon";
import { usePokemon, usePokemonSpecies } from "../hooks/usePokemon";
import { TypeBadge } from "../components/TypeBadge";
import { StatBar } from "../components/StatBar";
import { EvolutionChain } from "../components/EvolutionChain";

export function PokemonDetailPage() {
  const { id = "" } = useParams();
  const { data: pokemon, isPending, isError, error } = usePokemon(id);
  const { data: species } = usePokemonSpecies(pokemon?.species.url);

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load this Pokémon: {error.message}</p>;

  const description = species?.flavor_text_entries
    .find((entry) => entry.language.name === "en")
    ?.flavor_text.replace(/[\f\n]/g, " ");

  return (
    <main>
      <Link to="/" className="back">← Back to Pokédex</Link>

      <header className="detail-header">
        <img src={getArtworkUrl(pokemon.id)} alt={pokemon.name} width={240} height={240} />
        <div>
          <span className="number">#{String(pokemon.id).padStart(3, "0")}</span>
          <h1 className="name">{pokemon.name}</h1>
          <div className="types">
            {pokemon.types.map((t) => (
              <TypeBadge key={t.type.name} type={t.type.name} />
            ))}
          </div>
          {description && <p>{description}</p>}
          <p className="muted">
            Height {pokemon.height / 10} m, weight {pokemon.weight / 10} kg
          </p>
        </div>
      </header>

      <section>
        <h2>Base stats</h2>
        {pokemon.stats.map((s) => (
          <StatBar key={s.stat.name} name={s.stat.name} value={s.base_stat} />
        ))}
      </section>

      <section>
        <h2>Abilities</h2>
        <ul className="abilities">
          {pokemon.abilities.map((a) => (
            <li key={a.ability.name}>
              {a.ability.name.replaceAll("-", " ")}
              {a.is_hidden && <span className="muted"> (hidden)</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Evolution</h2>
        <EvolutionChain url={species?.evolution_chain.url} />
      </section>
    </main>
  );
}
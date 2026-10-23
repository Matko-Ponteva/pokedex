import { Link, useParams } from "react-router";
import { HttpError } from "../api/pokemon";
import { usePokemon } from "../hooks/usePokemon";
import { TypeBadge } from "../components/TypeBadge";
import { StatBar } from "../components/StatBar";
import { EvolutionChain } from "../components/EvolutionChain";

export function PokemonDetailPage() {
  const { id = "" } = useParams();
  const { data: pokemon, isPending, isError, error } = usePokemon(id);

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) {
    const notFound =
      error instanceof HttpError && (error.status === 404 || error.status === 400);
    return (
      <main className="status">
        <p>
          {notFound
            ? `There's no Pokémon with the ID ${id}.`
            : "Couldn't load this Pokémon. Check your connection and try again."}
        </p>
        <Link to="/">Back to Pokédex</Link>
      </main>
    );
  }

  return (
    <main>
      <Link to="/" className="back">← Back to Pokédex</Link>

      <header className="detail-header">
        <img src={pokemon.artworkUrl} alt={pokemon.name} width={240} height={240} />
        <div>
          <span className="number">#{String(pokemon.id).padStart(3, "0")}</span>
          <h1 className="name">{pokemon.name}</h1>
          <div className="types">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          {pokemon.description && <p>{pokemon.description}</p>}
          <p className="muted">
            Height {pokemon.heightMeters} m, weight {pokemon.weightKg} kg
          </p>
        </div>
      </header>

      <section>
        <h2>Base stats</h2>
        {pokemon.stats.map((s) => (
          <StatBar key={s.name} name={s.name} value={s.value} />
        ))}
      </section>

      <section>
        <h2>Abilities</h2>
        <ul className="abilities">
          {pokemon.abilities.map((a) => (
            <li key={a.name}>
              {a.name}
              {a.hidden && <span className="muted"> (hidden)</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Evolution</h2>
        <EvolutionChain stages={pokemon.evolution} />
      </section>
    </main>
  );
}
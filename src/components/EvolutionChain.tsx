import { Link } from "react-router";
import { getIdFromUrl, getSpriteUrl, type ChainLink } from "../api/pokemon";
import { useEvolutionChain } from "../hooks/usePokemon";

type Stage = { name: string; id: number }[];

function toStages(root: ChainLink): Stage[] {
  const stages: Stage[] = [];
  let current = [root];
  while (current.length > 0) {
    stages.push(current.map((link) => ({
      name: link.species.name,
      id: getIdFromUrl(link.species.url),
    })));
    current = current.flatMap((link) => link.evolves_to);
  }
  return stages;
}

export function EvolutionChain({ url }: { url: string | undefined }) {
  const { data, isPending, isError } = useEvolutionChain(url);

  if (isPending) return <p className="muted">Loading evolutions…</p>;
  if (isError) return <p className="muted">Couldn't load evolutions.</p>;

  const stages = toStages(data.chain);
  if (stages.length === 1) return <p className="muted">This Pokémon doesn't evolve.</p>;

  return (
    <div className="evolution">
      {stages.map((stage, i) => (
        <div className="evo-stage" key={i}>
          {stage.map((p) => (
            <Link key={p.id} to={`/pokemon/${p.id}`} className="evo-item">
              <img src={getSpriteUrl(p.id)} alt={p.name} width={80} height={80} />
              <span>{p.name}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
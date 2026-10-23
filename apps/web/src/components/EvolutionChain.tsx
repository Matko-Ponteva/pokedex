import { Link } from "react-router";
import type { EvolutionStage } from "@pokedex/shared";

export function EvolutionChain({ stages }: { stages: EvolutionStage[] }) {
  if (stages.length <= 1) return <p className="muted">This Pokémon doesn't evolve.</p>;

  return (
    <div className="evolution">
      {stages.map((stage, i) => (
        <div className="evo-stage" key={i}>
          {stage.map((p) => (
            <Link key={p.id} to={`/pokemon/${p.id}`} className="evo-item">
              <img src={p.spriteUrl} alt={p.name} width={80} height={80} />
              <span>{p.name}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
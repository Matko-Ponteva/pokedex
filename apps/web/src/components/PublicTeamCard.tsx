import { Link } from "react-router";
import type { PublicTeam } from "@pokedex/shared";

export function PublicTeamCard({ team }: { team: PublicTeam }) {
  return (
    <li className="team-card">
      <Link to={`/t/${team.shareId}`} className="public-team-link">
        <h2>{team.name}</h2>
        <p className="muted">by {team.ownerName}</p>
        <div className="team-sprites">
          {team.members.map((member) => (
            <img
              key={member.slot}
              src={member.pokemon.spriteUrl}
              alt={member.pokemon.name}
              width={56}
              height={56}
              loading="lazy"
            />
          ))}
        </div>
      </Link>
    </li>
  );
}
import { Link, useLocation } from "react-router";
import type { PublicTeam } from "@pokedex/shared";
import { useCurrentUser } from "../hooks/useAuth";
import { useLikeTeam } from "../hooks/useTeams";

export function LikeButton({ team }: { team: PublicTeam }) {
  const { data: user } = useCurrentUser();
  const like = useLikeTeam();
  const location = useLocation();
  const count = `${team.likeCount} ${team.likeCount === 1 ? "like" : "likes"}`;

  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname + location.search }}
        className="like-button"
        aria-label={`${count}. Log in to like this team`}
      >
        <span aria-hidden="true">♡</span> {team.likeCount}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={team.likedByMe ? "like-button liked" : "like-button"}
      aria-pressed={team.likedByMe}
      aria-label={`Like this team, ${count}`}
      disabled={like.isPending}
      onClick={() => like.mutate({ shareId: team.shareId, liked: !team.likedByMe })}
    >
      <span aria-hidden="true">{team.likedByMe ? "♥" : "♡"}</span> {team.likeCount}
    </button>
  );
}
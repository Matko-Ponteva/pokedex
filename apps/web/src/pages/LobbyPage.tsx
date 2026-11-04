import { useState } from "react";
import { Link } from "react-router";
import { useCurrentUser } from "../hooks/useAuth";
import { useLiveBattles, useOnlineUsers, useSocketConnected } from "../realtime/useSocket";
import { useBattleState } from "../realtime/battleStore";
import { ChallengeForm, IncomingChallengeCard, OutgoingChallengeCard } from "../components/ChallengeCards";

export function LobbyPage() {
  const { data: me } = useCurrentUser();
  const connected = useSocketConnected();
  const users = useOnlineUsers();
  const { challenges, notices } = useBattleState();
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const liveBattles = useLiveBattles();

  const incomingChallenges = challenges.filter((c) => c.to.id === me?.id);
  const outgoingChallenge = challenges.find((c) => c.from.id === me?.id);

  return (
    <main>
      <div className="page-header">
        <h1>Lobby</h1>
        <span className={connected ? "status-dot online" : "status-dot"}>
          {connected ? "Connected" : "Connecting…"}
        </span>
      </div>

      {notices.length > 0 && (
        <ul className="notices" role="status">
          {notices.map((notice) => (
            <li key={notice.key}>{notice.message}</li>
          ))}
        </ul>
      )}

      {incomingChallenges.length > 0 && (
        <section>
          <h2>Waiting for you</h2>
          {incomingChallenges.map((challenge) => (
            <IncomingChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      {outgoingChallenge && (
        <section>
          <h2>Sent by you</h2>
          {outgoingChallenge && <OutgoingChallengeCard challenge={outgoingChallenge} />}
        </section>
      )}

      {liveBattles.length > 0 && (
        <section>
          <h2>Live battles</h2>
          <ul className="live-battles">
            {liveBattles.map((live) => {
              const playing = live.players.some((player) => player.id === me?.id);
              return (
                <li key={live.id}>
                  <span className="online-name">
                    {live.players[0].displayName} <span className="muted">vs</span> {live.players[1].displayName}
                  </span>
                  <span className="muted">
                    {live.ruleset.name} · Turn {live.turn + 1} · {live.spectators === 1 ? "1 spectator" : `${live.spectators} spectators`}
                  </span>
                  <Link className="button" to={playing ? `/battle/${live.id}` : `/battle/${live.id}/watch`}>
                    {playing ? "Return" : "Watch"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2>Online trainers</h2>
        {users === null ? (
          <p className="status">Loading…</p>
        ) : (
          <ul className="online-list">
            {users.map((user) => {
              const isMe = user.id === me?.id;
              const open = openUserId === user.id;
              return (
                <li key={user.id}>
                  <div className="online-row">
                    <span className="status-dot online" aria-hidden="true" />
                    <span className="online-name">
                      {user.displayName}
                      {isMe && <span className="muted"> (you)</span>}
                    </span>
                    {!isMe && !open && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={outgoingChallenge !== undefined}
                        onClick={() => setOpenUserId(user.id)}
                      >
                        Challenge
                      </button>
                    )}
                  </div>
                  {open && <ChallengeForm to={user} onClose={() => setOpenUserId(null)} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
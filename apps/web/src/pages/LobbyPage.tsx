import { useState } from "react";
import { useCurrentUser } from "../hooks/useAuth";
import { useOnlineUsers, useSocketConnected } from "../realtime/useSocket";
import { useBattleState } from "../realtime/battleStore";
import { ChallengeForm, IncomingChallengeCard, OutgoingChallengeCard } from "../components/ChallengeCards";

export function LobbyPage() {
  const { data: me } = useCurrentUser();
  const connected = useSocketConnected();
  const users = useOnlineUsers();
  const { challenges, notices } = useBattleState();
  const [openUserId, setOpenUserId] = useState<number | null>(null);

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
import { useState } from "react";
import { Link } from "react-router";
import { useCurrentUser } from "../hooks/useAuth";
import { useLiveBattles, useOnlineUsers, useSocketConnected } from "../realtime/useSocket";
import { useTradeState } from "../realtime/tradeStore";
import { useBattleState } from "../realtime/battleStore";
import { IncomingTradeCard, OfferForm, OutgoingTradeCard } from "../components/TradeCards";
import { ChallengeForm, IncomingChallengeCard, OutgoingChallengeCard } from "../components/ChallengeCards";

type Panel = { userId: number; kind: "trade" | "battle" };

export function LobbyPage() {
  const { data: me } = useCurrentUser();
  const connected = useSocketConnected();
  const users = useOnlineUsers();
  const liveBattles = useLiveBattles();
  const { trades, notices: tradeNotices } = useTradeState();
  const { challenges, notices: battleNotices } = useBattleState();
  const [panel, setPanel] = useState<Panel | null>(null);

  const incomingOffers = trades.filter((t) => t.to.id === me?.id);
  const outgoingOffer = trades.find((t) => t.from.id === me?.id);
  const incomingChallenges = challenges.filter((c) => c.to.id === me?.id);
  const outgoingChallenge = challenges.find((c) => c.from.id === me?.id);

  const notices = [
    ...battleNotices.map((n) => ({ key: `battle-${n.key}`, message: n.message, done: false })),
    ...tradeNotices.map((n) => ({ key: `trade-${n.key}`, message: n.message, done: n.reason === "completed" })),
  ];

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
            <li key={notice.key} className={notice.done ? "done" : undefined}>
              {notice.message}
            </li>
          ))}
        </ul>
      )}

      {(incomingChallenges.length > 0 || incomingOffers.length > 0) && (
        <section>
          <h2>Waiting for you</h2>
          {incomingChallenges.map((challenge) => (
            <IncomingChallengeCard key={challenge.id} challenge={challenge} />
          ))}
          {incomingOffers.map((offer) => (
            <IncomingTradeCard key={offer.id} offer={offer} />
          ))}
        </section>
      )}

      {(outgoingChallenge || outgoingOffer) && (
        <section>
          <h2>Sent by you</h2>
          {outgoingChallenge && <OutgoingChallengeCard challenge={outgoingChallenge} />}
          {outgoingOffer && <OutgoingTradeCard offer={outgoingOffer} />}
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
              const open = panel?.userId === user.id ? panel.kind : null;
              return (
                <li key={user.id}>
                  <div className="online-row">
                    <span className="status-dot online" aria-hidden="true" />
                    <span className="online-name">
                      {user.displayName}
                      {isMe && <span className="muted"> (you)</span>}
                    </span>
                    {!isMe && open === null && (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          disabled={outgoingOffer !== undefined}
                          onClick={() => setPanel({ userId: user.id, kind: "trade" })}
                        >
                          Offer a trade
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={outgoingChallenge !== undefined}
                          onClick={() => setPanel({ userId: user.id, kind: "battle" })}
                        >
                          Challenge
                        </button>
                      </>
                    )}
                  </div>
                  {open === "trade" && <OfferForm to={user} onClose={() => setPanel(null)} />}
                  {open === "battle" && <ChallengeForm to={user} onClose={() => setPanel(null)} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
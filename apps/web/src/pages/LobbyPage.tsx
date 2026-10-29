import { useState } from "react";
import { useCurrentUser } from "../hooks/useAuth";
import { useOnlineUsers, useSocketConnected } from "../realtime/useSocket";
import { useTradeState } from "../realtime/tradeStore";
import { IncomingTradeCard, OfferForm, OutgoingTradeCard } from "../components/TradeCards";

export function LobbyPage() {
  const { data: me } = useCurrentUser();
  const connected = useSocketConnected();
  const users = useOnlineUsers();
  const { trades, notices } = useTradeState();
  const [offeringTo, setOfferingTo] = useState<number | null>(null);

  const incoming = trades.filter((trade) => trade.to.id === me?.id);
  const outgoing = trades.find((trade) => trade.from.id === me?.id);

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
            <li key={notice.key} className={notice.reason === "completed" ? "done" : undefined}>
              {notice.message}
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <section>
          <h2>Offers for you</h2>
          {incoming.map((offer) => (
            <IncomingTradeCard key={offer.id} offer={offer} />
          ))}
        </section>
      )}

      {outgoing && (
        <section>
          <h2>Your offer</h2>
          <OutgoingTradeCard offer={outgoing} />
        </section>
      )}

      <section>
        <h2>Online trainers</h2>
        {users === null ? (
          <p className="status">Loading…</p>
        ) : (
          <ul className="online-list">
            {users.map((user) => (
              <li key={user.id}>
                <div className="online-row">
                  <span className="status-dot online" aria-hidden="true" />
                  <span className="online-name">
                    {user.displayName}
                    {user.id === me?.id && <span className="muted"> (you)</span>}
                  </span>
                  {user.id !== me?.id && offeringTo !== user.id && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={outgoing !== undefined}
                      onClick={() => setOfferingTo(user.id)}
                    >
                      Offer a trade
                    </button>
                  )}
                </div>
                {offeringTo === user.id && (
                  <OfferForm to={user} onClose={() => setOfferingTo(null)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
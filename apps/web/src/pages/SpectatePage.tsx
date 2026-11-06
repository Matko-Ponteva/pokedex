import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { PublicSide, SpectatorView } from "@pokedex/shared";
import { BattleField } from "../components/battle/BattleField";
import { BattleSidebar } from "../components/battle/BattleSidebar";
import { bySlot, fieldSidesOf, useTurnPlayback } from "../components/battle/useTurnPlayback";
import { secondsUntil, useNow } from "../components/battle/time";
import { useCurrentUser } from "../hooks/useAuth";
import { sendChat } from "../realtime/battleActions";
import { useBattleChat } from "../realtime/chatStore";
import { unwatchBattle, useSpectatorView, watchBattle } from "../realtime/spectateStore";
import { useSocketConnected } from "../realtime/useSocket";

export function SpectatePage() {
  const { battleId } = useParams();
  const connected = useSocketConnected();
  const view = useSpectatorView(battleId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !battleId) return;
    let cancelled = false;
    watchBattle(battleId).then((message) => {
      if (!cancelled) setError(message);
    });
    return () => {
      cancelled = true;
      unwatchBattle(battleId);
    };
  }, [connected, battleId]);

  if (!view) {
    return (
      <main className="status">
        <p>{error ?? (connected ? "Joining the battle…" : "Reconnecting…")}</p>
        {error === "You're playing in this battle" && battleId && (
          <p>
            <Link to={`/battle/${battleId}`}>Go to your battle</Link>
          </p>
        )}
        <Link to="/lobby">Back to the lobby</Link>
      </main>
    );
  }

  return <Spectating view={view} />;
}

function Spectating({ view }: { view: SpectatorView }) {
  const { data: user } = useCurrentUser();
  const chat = useBattleChat(view.id);
  const now = useNow();
  const activesOf = (side: PublicSide) => side.actives ?? [side.active];
  const final = bySlot([activesOf(view.sides[0]), activesOf(view.sides[1])]);
  const playback = useTurnPlayback({
    lastTurn: view.lastTurn,
    log: view.log,
    final,
    finalWeather: view.weather?.kind ?? null,
    finalField: view.field,
  });

  const [first, second] = view.sides;
  const finished = view.winner !== null;
  const winnerName = view.sides.find((side) => side.userId === view.winner)?.displayName;
  const secondsLeft = secondsUntil(view.turnEndsAt, now);
  const party = (index: 0 | 1) =>
    Array.from({ length: view.sides[index].teamSize }, (_, i) => i < view.sides[index].remaining);

  const status = playback.playing
    ? (playback.event?.text ?? "…")
    : finished
      ? `${winnerName ?? "Someone"} won the battle!`
      : view.replacing.some(Boolean)
        ? `${view.sides
            .filter((_, index) => view.replacing[index])
            .map((side) => side.displayName)
            .join(" and ")} must choose their next Pokémon…`
      : view.sides
          .map((side, index) => `${side.displayName}: ${view.chosen[index] ? "ready" : "choosing…"}`)
          .join(" · ");

  return (
    <main className="battle-page">
      <div className="battle-heading">
        <h1>
          {first.displayName} <span className="muted">vs</span> {second.displayName}
        </h1>
        <span className="ruleset-chip" title={view.ruleset.description}>
          {view.ruleset.name} · Lv{view.ruleset.level}
        </span>
        <span className="spectating-badge">Spectating</span>
        <Link to="/lobby" className="button secondary-link">
          Leave
        </Link>
      </div>

      <div className="battle-layout">
        <div className="battle-main">
          <BattleField
            top={fieldSidesOf(playback, 1, { trainer: second.displayName, party: party(1), showHpNumbers: false })}
            bottom={fieldSidesOf(playback, 0, { trainer: first.displayName, party: party(0), showHpNumbers: false })}
            event={playback.event}
            eventKey={playback.eventKey}
            banner={!playback.playing && finished ? `${winnerName ?? "Someone"} wins!` : null}
            weather={playback.weather}
            weatherTurns={playback.playing ? null : view.weather?.turnsLeft}
            field={playback.field}
          />
          <div className="battle-command">
            <p className={finished ? "battle-status finished" : "battle-status"} role="status">
              {status}
            </p>
            {!finished && secondsLeft !== null && (
              <p className="battle-timer">Turn {view.turn + 1} · {secondsLeft}s left</p>
            )}
            {view.chatModes.some((mode) => mode === "private") && (
              <p className="muted">
                {view.sides
                  .filter((_, index) => view.chatModes[index] === "private")
                  .map((side) => side.displayName)
                  .join(" and ")}{" "}
                can't see spectator messages right now.
              </p>
            )}
          </div>
        </div>

        <BattleSidebar
          log={playback.log}
          chat={chat}
          myUserId={user?.id}
          playerIds={[first.userId, second.userId]}
          mode={null}
          spectators={view.spectators}
          onSend={(text) => sendChat(view.id, text)}
        />
      </div>
    </main>
  );
}

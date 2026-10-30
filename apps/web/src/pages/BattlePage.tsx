import { useState } from "react";
import { Link, useParams } from "react-router";
import type { Combatant } from "@pokedex/shared";
import { TypeBadge } from "../components/TypeBadge";
import { formatMove, formatPokemonName } from "../lib/format";
import { useBattleState } from "../realtime/battleStore";
import { socket } from "../realtime/socket";
import { useSocketConnected } from "../realtime/useSocket";

type Shown = Pick<Combatant, "name" | "spriteUrl" | "types" | "hp" | "maxHp">;

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const percent = Math.round((hp / maxHp) * 100);
  const level = percent > 50 ? "high" : percent > 20 ? "mid" : "low";
  return (
    <div className="hp">
      <div className="hp-track" role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
        <div className={`hp-fill ${level}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="hp-text">
        {hp} / {maxHp} HP
      </span>
    </div>
  );
}

function CombatantCard({ label, combatant, note }: { label: string; combatant: Shown; note: string }) {
  return (
    <div className="combatant">
      <span className="muted">{label}</span>
      <img src={combatant.spriteUrl} alt="" width={96} height={96} />
      <h3>{formatPokemonName(combatant.name)}</h3>
      <div className="card-types">
        {combatant.types.map((type) => (
          <TypeBadge key={type} type={type} />
        ))}
      </div>
      <HpBar hp={combatant.hp} maxHp={combatant.maxHp} />
      <span className="muted">{note}</span>
    </div>
  );
}

export function BattlePage() {
  const { battleId } = useParams();
  const { battle } = useBattleState();
  const connected = useSocketConnected();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!battle || battle.id !== battleId) {
    return (
      <main className="status">
        <p>{connected ? "This battle isn't available." : "Reconnecting…"}</p>
        <Link to="/lobby">Back to the lobby</Link>
      </main>
    );
  }

  const mine = battle.me.team[battle.me.active];
  const opponentName = battle.opponent.displayName;
  const finished = battle.winner !== null;
  const myRemaining = battle.me.team.filter((c) => c.hp > 0).length;

  const status = finished
    ? battle.winner === battle.me.userId
      ? "You won the battle!"
      : `${opponentName} won the battle.`
    : battle.hasChosen
      ? `Waiting for ${opponentName}…`
      : battle.opponentHasChosen
        ? `${opponentName} has chosen. Your move!`
        : "Choose a move.";

  const choose = async (moveIndex: number) => {
    setSending(true);
    setError(null);
    try {
      const result = await socket
        .timeout(5000)
        .emitWithAck("battle:move", { battleId: battle.id, moveIndex });
      if (!result.ok) setError(result.error);
    } catch {
      setError("No answer from the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main>
      <h1>
        {battle.me.displayName} vs {opponentName}
      </h1>
      <p className={finished ? "battle-status finished" : "battle-status"} role="status">
        {status}
      </p>

      <div className="arena">
        <CombatantCard label={opponentName} combatant={battle.opponent.active} note={`${battle.opponent.remaining} Pokémon left`} />
        <CombatantCard label="You" combatant={mine} note={`${myRemaining} Pokémon left`} />
      </div>

      {!finished && (
        <section>
          <h2>Your moves</h2>
          <div className="battle-moves">
            {mine.moves.map((move, index) => (
              <button
                key={move.name}
                type="button"
                className="battle-move"
                disabled={battle.hasChosen || sending}
                onClick={() => choose(index)}
              >
                <span>{formatMove(move.name)}</span>
                <span className="battle-move-info">
                  <TypeBadge type={move.type} /> power {move.power ?? "none"}
                </span>
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
      )}

      <section>
        <h2>Your team</h2>
        <ul className="bench">
          {battle.me.team.map((combatant, index) => (
            <li key={index} className={combatant.hp === 0 ? "fainted" : undefined}>
              <img src={combatant.spriteUrl} alt="" width={40} height={40} />
              <span>{formatPokemonName(combatant.name)}</span>
              <HpBar hp={combatant.hp} maxHp={combatant.maxHp} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Battle log</h2>
        <ol className="battle-log">
          {[...battle.log].reverse().map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </section>

      <div className="trade-actions">
        {finished ? (
          <Link to="/lobby" className="button">
            Back to the lobby
          </Link>
        ) : (
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (window.confirm("Forfeit this battle?")) {
                socket.emit("battle:forfeit", { battleId: battle.id });
              }
            }}
          >
            Forfeit
          </button>
        )}
      </div>
    </main>
  );
}
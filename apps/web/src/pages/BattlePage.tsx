import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  STAT_NAMES, TEAM_TARGET_MOVES, abilityName, itemName, multiHitNote, fieldMoveNote, hasStatusEffect, specialMoveNote, statusMoveNote, weatherMoveNote, shown, type BattleChoice, type BattleView, type MoveInfo, type ShownCombatant } from "@pokedex/shared";
import { TypeBadge } from "../components/TypeBadge";
import { BattleField, HpBar, StatusPill } from "../components/battle/BattleField";
import { BattleSidebar } from "../components/battle/BattleSidebar";
import { useTurnPlayback } from "../components/battle/useTurnPlayback";
import { secondsUntil, useNow } from "../components/battle/time";
import { TYPE_COLORS, isLightType } from "../data/types";
import { useCurrentUser } from "../hooks/useAuth";
import { formatMove, formatPokemonName } from "../lib/format";
import { sendChat, setChatMode } from "../realtime/battleActions";
import { useBattleState } from "../realtime/battleStore";
import { useBattleChat } from "../realtime/chatStore";
import { socket } from "../realtime/socket";
import { useSocketConnected } from "../realtime/useSocket";

const CATEGORY_LABELS = { physical: "Physical", special: "Special", status: "Status" } as const;
const AILMENT_LABELS = { burn: "Burns", poison: "Poisons", paralysis: "Paralyzes", sleep: "Sleep", freeze: "Freezes" } as const;

/** A short summary of what a move does besides damage */
function moveEffect(move: MoveInfo): string | null {
  const parts: string[] = [];
  const priority = move.priority ?? 0;
  if (priority !== 0) parts.push(`Priority ${priority > 0 ? "+" : ""}${priority}`);
  const note = specialMoveNote(move) ?? weatherMoveNote(move) ?? fieldMoveNote(move) ?? statusMoveNote(move);
  if (note) parts.push(note);
  const hits = multiHitNote(move);
  if (hits) parts.push(hits);
  if (move.category === "status" && !hasStatusEffect(move)) parts.push("No effect in battles yet");
  if (move.name === "protect" || move.name === "detect") parts.push("Blocks the foe's move");
  if (move.ailment) {
    const chance = move.category === "status" || !move.ailmentChance ? "" : ` (${move.ailmentChance}%)`;
    parts.push(`${AILMENT_LABELS[move.ailment]}${chance}`);
  }
  for (const { stat, change } of move.statChanges ?? []) {
    const who = move.statTarget === "user" ? "" : " (foe)";
    const chance = move.category !== "status" && move.statChance ? ` ${move.statChance}%` : "";
    parts.push(`${change > 0 ? "+" : ""}${change} ${STAT_NAMES[stat]}${who}${chance}`);
  }
  // Swallow's healing depends on Stockpile, which its note covers
  if (move.healing && move.name !== "swallow") parts.push(`Heals ${move.healing}%`);
  if (move.drain && move.drain > 0) parts.push(`Drains ${move.drain}%`);
  if (move.drain && move.drain < 0) parts.push(`${-move.drain}% recoil`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function BattlePage() {
  const { battleId } = useParams();
  const { battle } = useBattleState();
  const connected = useSocketConnected();

  if (!battle || battle.id !== battleId) {
    return (
      <main className="status">
        <p>{connected ? "You aren't playing in this battle." : "Reconnecting…"}</p>
        {connected && battleId && (
          <p>
            <Link to={`/battle/${battleId}/watch`}>Watch it as a spectator</Link>
          </p>
        )}
        <Link to="/lobby">Back to the lobby</Link>
      </main>
    );
  }

  return <PlayerBattle battle={battle} />;
}

function PlayerBattle({ battle }: { battle: BattleView }) {
  const { data: user } = useCurrentUser();
  const chat = useBattleChat(battle.id);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /** A move waiting for a team member to be picked: who comes in after U-turn, or who Revival Blessing revives */
  const [pending, setPending] = useState<{ index: number; revive: boolean } | null>(null);
  const now = useNow();

  const mySide = battle.mySide;
  const theirSide = mySide === 0 ? 1 : 0;
  const mine = battle.me.team[battle.me.active];
  // Bide locks the Pokémon in until it hits back
  const biding = Boolean(mine.bide) && mine.hp > 0;
  const final: [ShownCombatant, ShownCombatant] =
    mySide === 0 ? [shown(mine), battle.opponent.active] : [battle.opponent.active, shown(mine)];
  const playback = useTurnPlayback({
    lastTurn: battle.lastTurn,
    log: battle.log,
    final,
    finalWeather: battle.weather?.kind ?? null,
    finalField: battle.field,
  });

  const opponentName = battle.opponent.displayName;
  const finished = battle.winner !== null;
  const secondsLeft = secondsUntil(battle.turnEndsAt, now);
  const awaySeconds = secondsUntil(battle.opponentAwayUntil, now);
  const playerIds: [number, number] =
    mySide === 0 ? [battle.me.userId, battle.opponent.userId] : [battle.opponent.userId, battle.me.userId];

  const status = playback.playing
    ? (playback.event?.text ?? "…")
    : finished
      ? battle.winner === battle.me.userId
        ? "You won the battle!"
        : `${opponentName} won the battle.`
      : battle.mustReplace && !battle.hasChosen
        ? `${formatPokemonName(mine.name)} fainted! Choose your next Pokémon.`
        : battle.opponentMustReplace
          ? `Waiting for ${opponentName} to send out their next Pokémon…`
      : battle.hasChosen
        ? `Waiting for ${opponentName}…`
        : pending
          ? pending.revive
            ? "Choose a fainted teammate to revive."
            : `Choose who comes in after ${formatMove(mine.moves[pending.index].name)}.`
        : biding
          ? `${formatPokemonName(mine.name)} is storing energy! Pick any move to keep biding.`
        : battle.opponentHasChosen
          ? `${opponentName} has chosen. Your move!`
          : `What will ${formatPokemonName(mine.name)} do?`;

  const choose = async (choice: BattleChoice) => {
    setPending(null);
    setSending(true);
    setError(null);
    try {
      const result = await socket
        .timeout(5000)
        .emitWithAck("battle:action", { battleId: battle.id, choice });
      if (!result.ok) setError(result.error);
    } catch {
      setError("No answer from the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const replacePhase = battle.mustReplace || battle.opponentMustReplace;
  const ready = !finished && !battle.hasChosen && !sending && !playback.playing;
  // Moves need a normal turn; switching is also how you pick a replacement after a faint
  const canAct = ready && !replacePhase;
  const canSwitch = ready && (replacePhase ? battle.mustReplace : !battle.switchLock);
  // With every move out of PP or locked, any button makes the Pokémon struggle
  const struggling = !biding && battle.moveLocks.length > 0 && battle.moveLocks.every(Boolean);

  /** Moves like U-turn and Revival Blessing first ask which team member they're for, when there's a choice */
  const pickMove = (index: number) => {
    const move = mine.moves[index];
    if (!TEAM_TARGET_MOVES.has(move.name)) return choose({ kind: "move", index });
    const revive = move.name === "revival-blessing";
    const options = battle.me.team.flatMap((member, i) =>
      (revive ? member.hp === 0 : member.hp > 0 && i !== battle.me.active) ? [i] : []
    );
    if (options.length <= 1) return choose({ kind: "move", index, target: options[0] });
    setPending({ index, revive });
  };
  const choosingReplacement = battle.mustReplace && !battle.hasChosen && !playback.playing;

  const banner = !playback.playing && finished
    ? battle.winner === battle.me.userId ? "Victory!" : "Defeat"
    : null;

  return (
    <main className="battle-page">
      <div className="battle-heading">
        <h1>
          {battle.me.displayName} <span className="muted">vs</span> {opponentName}
        </h1>
        <span className="ruleset-chip" title={battle.ruleset.description}>
          {battle.ruleset.name} · Lv{battle.ruleset.level}
        </span>
        {!finished && (
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

      <div className="battle-layout">
        <div className="battle-main">
          <BattleField
            top={{
              side: theirSide,
              trainer: opponentName,
              combatant: playback.sides[theirSide],
              down: playback.down[theirSide],
              party: Array.from({ length: battle.opponent.teamSize }, (_, i) => i < battle.opponent.remaining),
              showHpNumbers: false,
            }}
            bottom={{
              side: mySide,
              trainer: battle.me.displayName,
              combatant: playback.sides[mySide],
              down: playback.down[mySide],
              party: battle.me.team.map((combatant) => combatant.hp > 0),
              showHpNumbers: true,
            }}
            event={playback.event}
            eventKey={playback.eventKey}
            banner={banner}
            weather={playback.weather}
            weatherTurns={playback.playing ? null : battle.weather?.turnsLeft}
            field={playback.field}
          />

          <div className="battle-command">
            <p className={finished ? "battle-status finished" : "battle-status"} role="status">
              {status}
            </p>
            {!finished && awaySeconds !== null && (
              <p className="opponent-away">
                {opponentName} lost their connection. They have {awaySeconds} seconds to come back, or they forfeit.
              </p>
            )}
            {!finished && secondsLeft !== null && !battle.hasChosen && (battle.mustReplace || !battle.opponentMustReplace) && (
              <p className={secondsLeft <= 10 ? "battle-timer urgent" : "battle-timer"}>
                {secondsLeft}s left to choose
              </p>
            )}
          </div>

          {finished ? (
            <Link to="/lobby" className="button">
              Back to the lobby
            </Link>
          ) : battle.mustReplace ? (
            error && <p className="form-error" role="alert">{error}</p>
          ) : (
            <section aria-label="Your moves">
              <div className="battle-moves">
                {mine.moves.map((move, index) => {
                  const effect = moveEffect(move);
                  const lock = struggling || biding ? null : battle.moveLocks[index];
                  const pp = mine.pp?.[index];
                  const maxPp = move.pp ? Math.floor((move.pp * 8) / 5) : null;
                  return (
                    <button
                      key={move.name}
                      type="button"
                      className={[
                        "battle-move",
                        isLightType(move.type) ? "on-light" : "on-dark",
                        move.category === "status" ? "status-move" : "",
                        lock ? "locked" : "",
                        pending?.index === index ? "pending" : "",
                      ].join(" ")}
                      style={{ backgroundColor: TYPE_COLORS[move.type] }}
                      disabled={!canAct || Boolean(lock)}
                      title={lock ?? undefined}
                      onClick={() => pickMove(index)}
                    >
                      <span className="battle-move-name">{formatMove(move.name)}</span>
                      <span className="battle-move-info">
                        <TypeBadge type={move.type} />
                        <span className="move-category">{CATEGORY_LABELS[move.category]}</span>
                        {move.category !== "status" && <span>Pow {move.power ?? "—"}</span>}
                        <span>Acc {move.accuracy ?? "—"}</span>
                        {pp !== null && pp !== undefined && maxPp !== null && (
                          <span className={pp === 0 ? "move-pp empty" : "move-pp"}>
                            PP {pp}/{maxPp}
                          </span>
                        )}
                      </span>
                      {lock && <span className="battle-move-lock">{lock}</span>}
                      {effect && <span className="battle-move-effect">{effect}</span>}
                    </button>
                  );
                })}
              </div>
              {struggling && canAct && (
                <p className="battle-note">No usable moves left: any move makes {formatPokemonName(mine.name)} use Struggle.</p>
              )}
              {pending && (
                <button type="button" className="secondary" onClick={() => setPending(null)}>
                  Cancel {formatMove(mine.moves[pending.index].name)}
                </button>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </section>
          )}

          <section
            aria-labelledby="bench-title"
            className={choosingReplacement || pending ? "bench-section choosing" : "bench-section"}
          >
            <h2 id="bench-title" className="bench-title">
              {choosingReplacement ? (
                "Choose your next Pokémon"
              ) : pending ? (
                pending.revive ? "Choose who to revive" : "Choose who comes in"
              ) : (
                <>
                  Your team{" "}
                  {!finished && (
                    <span className="muted">
                      ·{" "}
                      {battle.switchLock ?? "Switching uses your turn"}
                    </span>
                  )}
                </>
              )}
            </h2>
            <ul className="bench">
              {battle.me.team.map((combatant, index) => {
                const active = index === battle.me.active;
                const fainted = combatant.hp === 0;
                // While a move waits for a team member, the bench picks that member instead of switching
                const pickable = pending ? (pending.revive ? fainted : !fainted && !active) : canSwitch && !active && !fainted;
                const verb = pending ? (pending.revive ? "Revive" : "Bring in") : battle.mustReplace ? "Send in" : "Switch to";
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className={["bench-card", fainted ? "fainted" : "", active ? "active" : ""].join(" ")}
                      disabled={!pickable || (pending !== null && !canAct)}
                      aria-label={`${verb} ${formatPokemonName(combatant.name)}`}
                      onClick={() =>
                        pending ? choose({ kind: "move", index: pending.index, target: index }) : choose({ kind: "switch", index })
                      }
                    >
                      <img src={combatant.spriteUrl} alt="" width={48} height={48} />
                      <span className="bench-info">
                        <span className="bench-name">
                          {formatPokemonName(combatant.name)} <StatusPill status={combatant.status} />
                          {active && !fainted && <span className="bench-tag">In battle</span>}
                          {fainted && <span className="bench-tag">Fainted</span>}
                        </span>
                        <span className="bench-build">
                          {[combatant.ability && abilityName(combatant.ability), combatant.item && itemName(combatant.item)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <HpBar hp={combatant.hp} maxHp={combatant.maxHp} showNumbers />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <BattleSidebar
          log={playback.log}
          chat={chat}
          myUserId={user?.id}
          playerIds={playerIds}
          mode={battle.chatMode}
          spectators={battle.spectators}
          onSend={(text) => sendChat(battle.id, text)}
          onModeChange={(mode) => setChatMode(battle.id, mode)}
        />
      </div>
    </main>
  );
}

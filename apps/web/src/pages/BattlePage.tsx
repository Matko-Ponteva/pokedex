import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  STAT_NAMES, TEAM_TARGET_MOVES, abilityName, activeIndexes, activePerSide, itemName, multiHitNote, fieldMoveNote, hasStatusEffect,
  slotOf, slotPosition, slotSide, specialMoveNote, statusMoveNote, targetChoiceOf, targetNote, targetsFoe, weatherMoveNote, shown,
  type BattleChoice, type BattleView, type MoveInfo, type SideIndex, type Slot,
} from "@pokedex/shared";
import { TypeBadge } from "../components/TypeBadge";
import { BattleField, HpBar, StatusPill } from "../components/battle/BattleField";
import { BattleSidebar } from "../components/battle/BattleSidebar";
import { bySlot, fieldSidesOf, useTurnPlayback } from "../components/battle/useTurnPlayback";
import { secondsUntil, useNow } from "../components/battle/time";
import { TYPE_COLORS } from "../data/types";
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

/**
 * A move that needs more from the player before it's chosen: which Pokémon on the field it aims at (double battles),
 * then which team member it's for (who comes in after U-turn, who Revival Blessing revives)
 */
type MoveDraft = { index: number; stage: "aim" | "team"; targetSlot?: Slot; revive: boolean };

function PlayerBattle({ battle }: { battle: BattleView }) {
  const { data: user } = useCurrentUser();
  const chat = useBattleChat(battle.id);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const now = useNow();

  const mySide = battle.mySide;
  const theirSide: SideIndex = mySide === 0 ? 1 : 0;
  const doubles = battle.ruleset.format === "doubles";
  const team = battle.me.team;
  const myActives = activeIndexes(battle.me);
  const theirActives = battle.opponent.actives ?? [battle.opponent.active];
  const myShown = myActives.map((index) => shown(team[index]));
  const playback = useTurnPlayback({
    lastTurn: battle.lastTurn,
    log: battle.log,
    final: bySlot(mySide === 0 ? [myShown, theirActives] : [theirActives, myShown]),
    finalWeather: battle.weather?.kind ?? null,
    finalField: battle.field,
  });

  // The positions to choose for, in order: one choice each, sent together once all are made
  const positions = battle.mustReplace ? battle.replacePositions : battle.actingPositions;
  // Choices made so far; a new step (a turn, or sending in replacements) starts over
  const step = `${battle.turn}-${battle.lastTurn?.seq ?? 0}-${battle.mustReplace}`;
  const [draft, setDraft] = useState<{ step: string; picked: BattleChoice[]; move: MoveDraft | null }>({
    step,
    picked: [],
    move: null,
  });
  const picked = draft.step === step ? draft.picked : [];
  const moveDraft = draft.step === step ? draft.move : null;
  const setMoveDraft = (move: MoveDraft | null) => setDraft({ step, picked, move });

  const position = positions[Math.min(picked.length, positions.length - 1)] ?? 0;
  const mine = team[myActives[position] ?? battle.me.active];
  const nameAt = (pos: number) => formatPokemonName(team[myActives[pos] ?? battle.me.active].name);
  const slotName = (slot: Slot) =>
    slotSide(slot) === mySide ? nameAt(slotPosition(slot)) : formatPokemonName(theirActives[slotPosition(slot)]?.name ?? "");
  // Bide locks the Pokémon in until it hits back
  const biding = Boolean(mine.bide) && mine.hp > 0;

  /** Team members already coming in (switches, U-turn), or being revived, through an earlier position's choice */
  const takenBy = (choices: BattleChoice[]) =>
    new Set(choices.flatMap((choice) => (choice.kind === "switch" ? [choice.index] : choice.target !== undefined ? [choice.target] : [])));
  const taken = takenBy(picked);

  const opponentName = battle.opponent.displayName;
  const finished = battle.winner !== null;
  const secondsLeft = secondsUntil(battle.turnEndsAt, now);
  const awaySeconds = secondsUntil(battle.opponentAwayUntil, now);
  const playerIds: [number, number] =
    mySide === 0 ? [battle.me.userId, battle.opponent.userId] : [battle.opponent.userId, battle.me.userId];
  const draftMove = moveDraft ? formatMove(mine.moves[moveDraft.index].name) : "";

  const status = playback.playing
    ? (playback.event?.text ?? "…")
    : finished
      ? battle.winner === battle.me.userId
        ? "You won the battle!"
        : `${opponentName} won the battle.`
      : battle.mustReplace && !battle.hasChosen
        ? `${nameAt(position)} fainted! Choose your next Pokémon.`
        : battle.opponentMustReplace
          ? `Waiting for ${opponentName} to send out their next Pokémon…`
      : battle.hasChosen
        ? `Waiting for ${opponentName}…`
        : moveDraft
          ? moveDraft.stage === "aim"
            ? `Choose a target for ${draftMove}.`
            : moveDraft.revive
              ? "Choose a fainted teammate to revive."
              : `Choose who comes in after ${draftMove}.`
        : biding
          ? `${formatPokemonName(mine.name)} is storing energy! Pick any move to keep biding.`
        : battle.opponentHasChosen
          ? doubles
            ? `${opponentName} has chosen. What will ${formatPokemonName(mine.name)} do?`
            : `${opponentName} has chosen. Your move!`
          : `What will ${formatPokemonName(mine.name)} do?`;

  const submit = async (choices: BattleChoice[]) => {
    setDraft({ step, picked: [], move: null });
    // One entry per position; positions without a choice this time are null
    const byPosition: (BattleChoice | null)[] = Array.from({ length: activePerSide(battle.ruleset.format) }, () => null);
    choices.forEach((choice, i) => {
      byPosition[positions[i]] = choice;
    });
    setSending(true);
    setError(null);
    try {
      const result = await socket
        .timeout(5000)
        .emitWithAck("battle:action", { battleId: battle.id, choices: byPosition });
      if (!result.ok) setError(result.error);
    } catch {
      setError("No answer from the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  /** Healthy team members on the bench that aren't spoken for */
  const benchLeft = (choices: BattleChoice[]) => {
    const spoken = takenBy(choices);
    return team.filter((member, i) => member.hp > 0 && !myActives.includes(i) && !spoken.has(i)).length;
  };

  /** Records the current position's choice, and sends them all after the last one */
  const commit = (choice: BattleChoice) => {
    const next = [...picked, choice];
    // A replacement can't be picked once the bench runs out, so send what there is
    const done = next.length >= positions.length || (battle.mustReplace && benchLeft(next) === 0);
    if (done) return submit(next);
    setDraft({ step, picked: next, move: null });
  };

  const back = () => setDraft({ step, picked: picked.slice(0, -1), move: null });

  /** Who a move can aim at in a double battle, when the player has to choose */
  const targetOptions = (move: MoveInfo): { slot: Slot; label: string }[] => {
    const choice = doubles ? targetChoiceOf(move, targetsFoe(move)) : null;
    if (!choice) return [];
    const ownSlot = slotOf(mySide, position);
    const allies = myActives.flatMap((teamIndex, pos) => (pos !== position && team[teamIndex].hp > 0 ? [slotOf(mySide, pos)] : []));
    if (choice === "user-or-ally") {
      return [
        { slot: ownSlot, label: `Self: ${slotName(ownSlot)}` },
        ...allies.map((slot) => ({ slot, label: `Ally: ${slotName(slot)}` })),
      ];
    }
    const foes = theirActives.flatMap((foe, pos) => (foe.hp > 0 ? [slotOf(theirSide, pos)] : []));
    return [
      ...foes.map((slot) => ({ slot, label: `Foe: ${slotName(slot)} (${slotPosition(slot) === 0 ? "left" : "right"})` })),
      ...allies.map((slot) => ({ slot, label: `Ally: ${slotName(slot)}` })),
    ];
  };

  /** Moves like U-turn and Revival Blessing then ask which team member they're for, when there's a choice */
  const chooseTarget = (index: number, targetSlot: Slot | undefined) => {
    const move = mine.moves[index];
    const aimed = targetSlot === undefined ? {} : { targetSlot };
    if (!TEAM_TARGET_MOVES.has(move.name)) return commit({ kind: "move", index, ...aimed });
    const revive = move.name === "revival-blessing";
    const options = team.flatMap((member, i) =>
      !taken.has(i) && (revive ? member.hp === 0 : member.hp > 0 && !myActives.includes(i)) ? [i] : []
    );
    if (options.length <= 1) return commit({ kind: "move", index, target: options[0], ...aimed });
    setMoveDraft({ index, stage: "team", targetSlot, revive });
  };

  /** In a double battle, a move aimed at one Pokémon first asks which, unless only one can be hit */
  const pickMove = (index: number) => {
    const options = targetOptions(mine.moves[index]);
    if (options.length > 1) return setMoveDraft({ index, stage: "aim", revive: false });
    chooseTarget(index, options[0]?.slot);
  };

  const replacePhase = battle.mustReplace || battle.opponentMustReplace;
  const ready = !finished && !battle.hasChosen && !sending && !playback.playing;
  // Moves need a normal turn; switching is also how you pick a replacement after a faint
  const canAct = ready && !replacePhase && positions.length > 0;
  const canSwitch = ready && (replacePhase ? battle.mustReplace : !battle.switchLocks[position]);
  const locks = battle.moveLocks[position] ?? [];
  // With every move out of PP or locked, any button makes the Pokémon struggle
  const struggling = !biding && locks.length > 0 && locks.every(Boolean);
  const choosingReplacement = battle.mustReplace && !battle.hasChosen && !playback.playing;
  const teamPick = moveDraft?.stage === "team" ? moveDraft : null;

  /** What an earlier position will do, for the summary while choosing the next one */
  const describe = (choice: BattleChoice, i: number) => {
    const pos = positions[i];
    if (choice.kind === "switch") return `${nameAt(pos)}: switch to ${formatPokemonName(team[choice.index].name)}`;
    const move = formatMove(team[myActives[pos]].moves[choice.index].name);
    const aim = choice.targetSlot === undefined ? "" : ` → ${slotName(choice.targetSlot)}`;
    const target = choice.target === undefined ? "" : ` (${formatPokemonName(team[choice.target].name)})`;
    return `${nameAt(pos)}: ${move}${aim}${target}`;
  };

  const backButton = picked.length > 0 && !moveDraft && ready && (
    <button type="button" className="secondary" onClick={back}>
      Back to {nameAt(positions[picked.length - 1])}
    </button>
  );

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
            top={fieldSidesOf(playback, theirSide, {
              trainer: opponentName,
              party: Array.from({ length: battle.opponent.teamSize }, (_, i) => i < battle.opponent.remaining),
              showHpNumbers: false,
            })}
            bottom={fieldSidesOf(playback, mySide, {
              trainer: battle.me.displayName,
              party: team.map((combatant) => combatant.hp > 0),
              showHpNumbers: true,
            })}
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
            {picked.length > 0 && ready && <p className="muted">{picked.map(describe).join(" · ")}</p>}
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
            <>
              {backButton}
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          ) : (
            <section aria-label="Your moves">
              <div className="battle-moves">
                {mine.moves.map((move, index) => {
                  const effect = moveEffect(move);
                  const lock = struggling || biding ? null : locks[index];
                  const pp = mine.pp?.[index];
                  const maxPp = move.pp ? Math.floor((move.pp * 8) / 5) : null;
                  const note = doubles ? targetNote(move, targetsFoe(move)) : null;
                  return (
                    <button
                      key={move.name}
                      type="button"
                      className={[
                        "battle-move",
                        move.category === "status" ? "status-move" : "",
                        lock ? "locked" : "",
                        moveDraft?.index === index ? "pending" : "",
                      ].join(" ")}
                      style={{ borderLeftColor: TYPE_COLORS[move.type] }}
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
                      {note && <span className="battle-move-target">{note}</span>}
                      {effect && <span className="battle-move-effect">{effect}</span>}
                    </button>
                  );
                })}
              </div>
              {moveDraft?.stage === "aim" && (
                <div className="target-picker" role="group" aria-label={`Target for ${draftMove}`}>
                  {targetOptions(mine.moves[moveDraft.index]).map((option) => (
                    <button
                      key={option.slot}
                      type="button"
                      className={slotSide(option.slot) === mySide ? "target-ally" : "target-foe"}
                      disabled={!canAct}
                      onClick={() => chooseTarget(moveDraft.index, option.slot)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {struggling && canAct && (
                <p className="battle-note">No usable moves left: any move makes {formatPokemonName(mine.name)} use Struggle.</p>
              )}
              {moveDraft && (
                <button type="button" className="secondary" onClick={() => setMoveDraft(null)}>
                  Cancel {draftMove}
                </button>
              )}
              {backButton}
              {error && <p className="form-error" role="alert">{error}</p>}
            </section>
          )}

          <section
            aria-labelledby="bench-title"
            className={choosingReplacement || teamPick ? "bench-section choosing" : "bench-section"}
          >
            <h2 id="bench-title" className="bench-title">
              {choosingReplacement ? (
                doubles ? `Choose who replaces ${nameAt(position)}` : "Choose your next Pokémon"
              ) : teamPick ? (
                teamPick.revive ? "Choose who to revive" : "Choose who comes in"
              ) : (
                <>
                  Your team{" "}
                  {!finished && (
                    <span className="muted">
                      ·{" "}
                      {battle.switchLocks[position] ??
                        (doubles ? `Switching uses ${formatPokemonName(mine.name)}'s turn` : "Switching uses your turn")}
                    </span>
                  )}
                </>
              )}
            </h2>
            <ul className="bench">
              {team.map((combatant, index) => {
                const active = myActives.includes(index);
                const fainted = combatant.hp === 0;
                // Already coming in (or being revived) through another position's choice
                const chosen = taken.has(index);
                // While a move waits for a team member, the bench picks that member instead of switching
                const pickable =
                  !chosen && (teamPick ? (teamPick.revive ? fainted : !fainted && !active) : canSwitch && !active && !fainted);
                const verb = teamPick ? (teamPick.revive ? "Revive" : "Bring in") : battle.mustReplace ? "Send in" : "Switch to";
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className={["bench-card", fainted ? "fainted" : "", active ? "active" : ""].join(" ")}
                      disabled={!pickable || (teamPick !== null && !canAct)}
                      aria-label={`${verb} ${formatPokemonName(combatant.name)}`}
                      onClick={() =>
                        teamPick
                          ? commit({
                              kind: "move",
                              index: teamPick.index,
                              target: index,
                              ...(teamPick.targetSlot === undefined ? {} : { targetSlot: teamPick.targetSlot }),
                            })
                          : commit({ kind: "switch", index })
                      }
                    >
                      <img src={combatant.spriteUrl} alt="" width={48} height={48} />
                      <span className="bench-info">
                        <span className="bench-name">
                          {formatPokemonName(combatant.name)} <StatusPill status={combatant.status} />
                          {active && !fainted && <span className="bench-tag">In battle</span>}
                          {chosen && <span className="bench-tag">Chosen</span>}
                          {fainted && !chosen && <span className="bench-tag">Fainted</span>}
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

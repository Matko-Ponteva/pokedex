import { useEffect, useState } from "react";
import type { BattleEvent, ShownCombatant, TurnRecord } from "@pokedex/shared";

type Pair<T> = [T, T];

/** How long each event stays on screen, in milliseconds */
const DURATION: Record<BattleEvent["kind"], number> = {
  move: 700,
  miss: 950,
  damage: 1050,
  immune: 950,
  status: 1150,
  "status-damage": 1050,
  "cant-move": 1150,
  cured: 850,
  stat: 1000,
  heal: 1000,
  recoil: 950,
  fail: 850,
  faint: 1150,
  withdraw: 750,
  switch: 950,
  win: 1000,
};

export type Playback = {
  /** The active Pokémon of each battle side, as currently shown */
  sides: Pair<ShownCombatant>;
  /** Sides whose Pokémon has fainted and left the field */
  down: Pair<boolean>;
  event: BattleEvent | null;
  /** Changes with every event, so animations restart */
  eventKey: string;
  playing: boolean;
  /** The battle log without the lines that haven't played yet */
  log: string[];
};

function applyEvent(sides: Pair<ShownCombatant>, down: Pair<boolean>, event: BattleEvent) {
  const side = event.side;
  switch (event.kind) {
    case "damage":
    case "status-damage":
    case "heal":
    case "recoil":
      sides[side] = { ...sides[side], hp: event.hp };
      break;
    case "stat":
      sides[side] = { ...sides[side], boosts: { ...sides[side].boosts, [event.stat]: (sides[side].boosts[event.stat] ?? 0) + event.change } };
      break;
    case "withdraw":
      down[side] = true;
      break;
    case "status":
      sides[side] = { ...sides[side], status: event.status };
      break;
    case "cured":
      sides[side] = { ...sides[side], status: null };
      break;
    case "faint":
      sides[side] = { ...sides[side], hp: 0 };
      down[side] = true;
      break;
    case "switch":
      sides[side] = event.combatant;
      down[side] = false;
      break;
  }
}

/** Where a turn's lines start in the log: they're at the end, maybe followed by a few later lines */
function findEventLines(log: string[], texts: string[]): number {
  const lowest = Math.max(0, log.length - texts.length - 5);
  for (let start = log.length - texts.length; start >= lowest; start--) {
    if (texts.every((text, i) => log[start + i] === text)) return start;
  }
  return -1;
}

/**
 * Replays the events of the step that just resolved (a turn, or sending in a
 * replacement), one at a time. On the first render, or when steps were missed
 * (a reconnect), it shows the final state.
 */
export function useTurnPlayback(input: {
  lastTurn: TurnRecord | null;
  log: string[];
  final: Pair<ShownCombatant>;
}): Playback {
  const { lastTurn, log, final } = input;
  const seq = lastTurn?.seq ?? 0;
  // Which step we've caught up with, and where the replay is. Starting the replay while
  // rendering (not in an effect) avoids a frame that shows the turn's result too early.
  const [tracked, setTracked] = useState<{ seq: number; step: number | null }>({ seq, step: null });
  if (tracked.seq !== seq) {
    const consecutive = seq === tracked.seq + 1 && (lastTurn?.events.length ?? 0) > 0;
    setTracked({ seq, step: consecutive ? 0 : null });
  }

  const step = tracked.seq === seq ? tracked.step : null;
  const active = step !== null && lastTurn !== null ? { seq, step } : null;
  const event = active ? lastTurn!.events[active.step] : null;

  useEffect(() => {
    if (step === null || !lastTurn) return;
    const current = lastTurn.events[step];
    if (!current) return;
    const last = step + 1 >= lastTurn.events.length;
    const timer = setTimeout(
      () => setTracked((t) => (t.seq === seq ? { seq, step: last ? null : step + 1 } : t)),
      DURATION[current.kind]
    );
    return () => clearTimeout(timer);
  }, [seq, step, lastTurn]);

  if (!active || !lastTurn || !event) {
    return {
      sides: final,
      down: [final[0].hp === 0, final[1].hp === 0],
      event: null,
      eventKey: "idle",
      playing: false,
      log,
    };
  }

  const sides: Pair<ShownCombatant> = [...lastTurn.start];
  const down: Pair<boolean> = [sides[0].hp === 0, sides[1].hp === 0];
  for (const played of lastTurn.events.slice(0, active.step + 1)) applyEvent(sides, down, played);

  // Hide the log lines of events that haven't played yet
  const texts = lastTurn.events.map((e) => e.text);
  const start = findEventLines(log, texts);
  const shownLog =
    start === -1 ? log : [...log.slice(0, start + active.step + 1), ...log.slice(start + texts.length)];

  return {
    sides,
    down,
    event,
    eventKey: `${seq}-${active.step}`,
    playing: true,
    log: shownLog,
  };
}

import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import type { BattleView, ChallengeInfo } from "@pokedex/shared";
import { socket } from "./socket";

type BattleNotice = { key: number; message: string };
type BattleState = {
  challenges: ChallengeInfo[];
  battle: BattleView | null;
  notices: BattleNotice[];
};

let state: BattleState = { challenges: [], battle: null, notices: [] };
let nextKey = 1;
const listeners = new Set<() => void>();

function update(next: BattleState) {
  state = next;
  for (const listener of listeners) listener();
}

socket.on("battle:challenged", (challenge) => {
  update({
    ...state,
    challenges: [...state.challenges.filter((c) => c.id !== challenge.id), challenge],
  });
});

socket.on("battle:challenge-closed", (event) => {
  update({
    ...state,
    challenges: state.challenges.filter((c) => c.id !== event.challengeId),
    notices: [{ key: nextKey++, message: event.message }, ...state.notices].slice(0, 5),
  });
});

socket.on("battle:state", (view) => {
  update({ ...state, battle: view });
});

socket.on("disconnect", () => {
  update({ challenges: [], battle: null, notices: [] });
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBattleState(): BattleState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useBattleNavigation() {
  const { battle } = useBattleState();
  const navigate = useNavigate();
  const ongoingId = battle && battle.winner === null ? battle.id : undefined;

  useEffect(() => {
    if (ongoingId) navigate(`/battle/${ongoingId}`);
  }, [ongoingId, navigate]);
}
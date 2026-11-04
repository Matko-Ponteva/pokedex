import { useSyncExternalStore } from "react";
import type { SpectatorView } from "@pokedex/shared";
import { setChat } from "./chatStore";
import { socket } from "./socket";

let watching: string | null = null;
let view: SpectatorView | null = null;
const listeners = new Set<() => void>();

function setView(next: SpectatorView | null) {
  view = next;
  for (const listener of listeners) listener();
}

socket.on("battle:spectate-state", (next) => {
  if (next.id === watching) setView(next);
});

socket.on("disconnect", () => setView(null));

/** Starts watching a battle. Resolves with an error message, or null on success. */
export async function watchBattle(battleId: string): Promise<string | null> {
  watching = battleId;
  try {
    const result = await socket.timeout(5000).emitWithAck("battle:watch", { battleId });
    if (watching !== battleId) return null;
    if (!result.ok) return result.error;
    setChat(battleId, result.data.chat);
    setView(result.data.view);
    return null;
  } catch {
    return "No answer from the server. Check your connection and try again.";
  }
}

export function unwatchBattle(battleId: string) {
  if (watching !== battleId) return;
  watching = null;
  setView(null);
  if (socket.connected) socket.emit("battle:unwatch", { battleId });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSpectatorView(battleId: string | undefined): SpectatorView | null {
  const current = useSyncExternalStore(subscribe, () => view);
  return current && current.id === battleId ? current : null;
}

import { useSyncExternalStore } from "react";
import type { ChatMessage } from "@pokedex/shared";
import { socket } from "./socket";

const MAX_MESSAGES = 100;
const EMPTY: ChatMessage[] = [];

let chats = new Map<string, ChatMessage[]>();
const listeners = new Set<() => void>();

function update(battleId: string, messages: ChatMessage[]) {
  chats = new Map(chats).set(battleId, messages.slice(-MAX_MESSAGES));
  for (const listener of listeners) listener();
}

export function setChat(battleId: string, messages: ChatMessage[]) {
  update(battleId, messages);
}

socket.on("battle:chat-message", (message) => {
  const current = chats.get(message.battleId) ?? EMPTY;
  if (current.some((m) => m.id === message.id)) return;
  update(message.battleId, [...current, message]);
});

socket.on("battle:chat-history", ({ battleId, messages }) => {
  update(battleId, messages);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBattleChat(battleId: string): ChatMessage[] {
  return useSyncExternalStore(subscribe, () => chats.get(battleId) ?? EMPTY);
}

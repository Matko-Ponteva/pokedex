import type { ChatMode } from "@pokedex/shared";
import { socket } from "./socket";

const NO_ANSWER = "No answer from the server. Check your connection and try again.";

/** Sends a chat message. Resolves with an error message, or null on success. */
export async function sendChat(battleId: string, text: string): Promise<string | null> {
  try {
    const result = await socket.timeout(5000).emitWithAck("battle:chat", { battleId, text });
    return result.ok ? null : result.error;
  } catch {
    return NO_ANSWER;
  }
}

export async function setChatMode(battleId: string, mode: ChatMode): Promise<string | null> {
  try {
    const result = await socket.timeout(5000).emitWithAck("battle:chat-mode", { battleId, mode });
    return result.ok ? null : result.error;
  } catch {
    return NO_ANSWER;
  }
}

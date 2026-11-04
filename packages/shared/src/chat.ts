import type { ChatMode } from "./battle.ts";

export const CHAT_MAX_LENGTH = 200;

export type ChatRole = "player" | "spectator";

export type ChatMessage = {
  id: string;
  battleId: string;
  from: { id: number; displayName: string };
  role: ChatRole;
  text: string;
  sentAt: string;
};

/**
 * Spectators see every message. A battler always sees both battlers' messages,
 * and spectators' messages only while their own chat is public.
 */
export function canSeeChat(
  message: Pick<ChatMessage, "role">,
  viewerId: number,
  playerIds: readonly number[],
  modes: ReadonlyMap<number, ChatMode>
): boolean {
  if (!playerIds.includes(viewerId)) return true;
  if (message.role === "player") return true;
  return (modes.get(viewerId) ?? "public") === "public";
}

/** Recognizes the /public and /private chat commands */
export function parseChatCommand(text: string): ChatMode | null {
  const command = text.trim().toLowerCase();
  if (command === "/public") return "public";
  if (command === "/private") return "private";
  return null;
}

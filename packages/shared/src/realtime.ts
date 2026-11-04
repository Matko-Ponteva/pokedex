import { z } from "zod";
import type { BattleView, SpectatorView } from "./battle.ts";
import { CHAT_MAX_LENGTH, type ChatMessage } from "./chat.ts";
import { DEFAULT_RULESET, rulesetIdSchema, type Ruleset } from "./rulesets.ts";

export type OnlineUser = {
  id: number;
  displayName: string;
};

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export const battleChallengeInputSchema = z.object({
  toUserId: z.number().int().positive(),
  teamId: z.number().int().positive(),
  rulesetId: rulesetIdSchema.default(DEFAULT_RULESET),
});
export type BattleChallengeInput = z.input<typeof battleChallengeInputSchema>;

export const battleRespondInputSchema = z.object({
  challengeId: z.uuid(),
  accept: z.boolean(),
  teamId: z.number().int().positive().optional(),
});
export type BattleRespondInput = z.infer<typeof battleRespondInputSchema>;

export const battleActionInputSchema = z.object({
  battleId: z.uuid(),
  choice: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("move"), index: z.number().int().min(0).max(3) }),
    z.object({ kind: z.literal("switch"), index: z.number().int().min(0).max(5) }),
  ]),
});
export type BattleActionInput = z.infer<typeof battleActionInputSchema>;

export const battleForfeitInputSchema = z.object({
  battleId: z.uuid(),
});
export type BattleForfeitInput = z.infer<typeof battleForfeitInputSchema>;

export const battleIdInputSchema = z.object({
  battleId: z.uuid(),
});
export type BattleIdInput = z.infer<typeof battleIdInputSchema>;

export const battleChatInputSchema = z.object({
  battleId: z.uuid(),
  text: z.string().trim().min(1, "Write a message first").max(CHAT_MAX_LENGTH, `Messages can be at most ${CHAT_MAX_LENGTH} characters`),
});
export type BattleChatInput = z.infer<typeof battleChatInputSchema>;

export const battleChatModeInputSchema = z.object({
  battleId: z.uuid(),
  mode: z.enum(["public", "private"]),
});
export type BattleChatModeInput = z.infer<typeof battleChatModeInputSchema>;

export type LiveBattleInfo = {
  id: string;
  players: [OnlineUser, OnlineUser];
  ruleset: Ruleset;
  turn: number;
  spectators: number;
};

export type WatchResult = {
  view: SpectatorView;
  chat: ChatMessage[];
};

export type ChatHistory = {
  battleId: string;
  messages: ChatMessage[];
};

export type ChallengeInfo = {
  id: string;
  from: OnlineUser;
  to: OnlineUser;
  ruleset: Ruleset;
  expiresAt: string;
};

export type ChallengeClosed = {
  challengeId: string;
  message: string;
};

export interface ServerToClientEvents {
  "lobby:users": (users: OnlineUser[]) => void;
  "battle:challenged": (challenge: ChallengeInfo) => void;
  "battle:challenge-closed": (event: ChallengeClosed) => void;
  "battle:state": (view: BattleView) => void;
  "battle:spectate-state": (view: SpectatorView) => void;
  "battle:chat-message": (message: ChatMessage) => void;
  "battle:chat-history": (history: ChatHistory) => void;
  "lobby:battles": (battles: LiveBattleInfo[]) => void;
}

export interface ClientToServerEvents {
  "lobby:join": (reply: (users: OnlineUser[]) => void) => void;
  "lobby:leave": () => void;
  "battle:challenge": (input: BattleChallengeInput, reply: (result: Ack<ChallengeInfo>) => void) => void;
  "battle:respond": (input: BattleRespondInput, reply: (result: Ack<null>) => void) => void;
  "battle:action": (input: BattleActionInput, reply: (result: Ack<null>) => void) => void;
  "battle:forfeit": (input: BattleForfeitInput) => void;
  "battle:watch": (input: BattleIdInput, reply: (result: Ack<WatchResult>) => void) => void;
  "battle:unwatch": (input: BattleIdInput) => void;
  "battle:chat": (input: BattleChatInput, reply: (result: Ack<null>) => void) => void;
  "battle:chat-mode": (input: BattleChatModeInput, reply: (result: Ack<null>) => void) => void;
  "lobby:battles": (reply: (battles: LiveBattleInfo[]) => void) => void;
}
import { z } from "zod";
import type { PokemonSummary } from "./index.ts";
import type { BattleView } from "./battle.ts";

export type OnlineUser = {
  id: number;
  displayName: string;
};

export const memberRefSchema = z.object({
  teamId: z.number().int().positive(),
  slot: z.number().int().min(1).max(6),
});
export type MemberRef = z.infer<typeof memberRefSchema>;

export const tradeOfferInputSchema = memberRefSchema.extend({
  toUserId: z.number().int().positive(),
});
export type TradeOfferInput = z.infer<typeof tradeOfferInputSchema>;

export const tradeAcceptInputSchema = memberRefSchema.extend({
  offerId: z.uuid(),
});
export type TradeAcceptInput = z.infer<typeof tradeAcceptInputSchema>;

export const tradeIdInputSchema = z.object({
  offerId: z.uuid(),
});
export type TradeIdInput = z.infer<typeof tradeIdInputSchema>;

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export type TradeOffer = {
  id: string;
  from: OnlineUser;
  to: OnlineUser;
  pokemon: PokemonSummary;
  teamName: string;
  expiresAt: string;
};

export type TradeCloseReason = "completed" | "declined" | "cancelled" | "expired" | "unavailable";

export type TradeClosed = {
  offerId: string;
  reason: TradeCloseReason;
  message: string;
};

export const battleChallengeInputSchema = z.object({
  toUserId: z.number().int().positive(),
  teamId: z.number().int().positive(),
});
export type BattleChallengeInput = z.infer<typeof battleChallengeInputSchema>;

export const battleRespondInputSchema = z.object({
  challengeId: z.uuid(),
  accept: z.boolean(),
  teamId: z.number().int().positive().optional(),
});
export type BattleRespondInput = z.infer<typeof battleRespondInputSchema>;

export const battleMoveInputSchema = z.object({
  battleId: z.uuid(),
  moveIndex: z.number().int().min(0).max(3),
});
export type BattleMoveInput = z.infer<typeof battleMoveInputSchema>;

export const battleForfeitInputSchema = z.object({
  battleId: z.uuid(),
});
export type BattleForfeitInput = z.infer<typeof battleForfeitInputSchema>;

export type ChallengeInfo = {
  id: string;
  from: OnlineUser;
  to: OnlineUser;
  expiresAt: string;
};

export type ChallengeClosed = {
  challengeId: string;
  message: string;
};

export interface ServerToClientEvents {
  "lobby:users": (users: OnlineUser[]) => void;
  "trade:offered": (offer: TradeOffer) => void;
  "trade:closed": (event: TradeClosed) => void;
  "battle:challenged": (challenge: ChallengeInfo) => void;
  "battle:challenge-closed": (event: ChallengeClosed) => void;
  "battle:state": (view: BattleView) => void;
}

export interface ClientToServerEvents {
  "lobby:join": (reply: (users: OnlineUser[]) => void) => void;
  "lobby:leave": () => void;
  "trade:offer": (input: TradeOfferInput, reply: (result: Ack<TradeOffer>) => void) => void;
  "trade:accept": (input: TradeAcceptInput, reply: (result: Ack<null>) => void) => void;
  "trade:decline": (input: TradeIdInput) => void;
  "trade:cancel": (input: TradeIdInput) => void;
  "battle:challenge": (input: BattleChallengeInput, reply: (result: Ack<ChallengeInfo>) => void) => void;
  "battle:respond": (input: BattleRespondInput, reply: (result: Ack<null>) => void) => void;
  "battle:move": (input: BattleMoveInput, reply: (result: Ack<null>) => void) => void;
  "battle:forfeit": (input: BattleForfeitInput) => void;
}
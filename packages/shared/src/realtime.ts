import { z } from "zod";
import type { BattleView } from "./battle.ts";

export type OnlineUser = {
  id: number;
  displayName: string;
};

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

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
  "battle:challenged": (challenge: ChallengeInfo) => void;
  "battle:challenge-closed": (event: ChallengeClosed) => void;
  "battle:state": (view: BattleView) => void;
}

export interface ClientToServerEvents {
  "lobby:join": (reply: (users: OnlineUser[]) => void) => void;
  "lobby:leave": () => void;
  "battle:challenge": (input: BattleChallengeInput, reply: (result: Ack<ChallengeInfo>) => void) => void;
  "battle:respond": (input: BattleRespondInput, reply: (result: Ack<null>) => void) => void;
  "battle:move": (input: BattleMoveInput, reply: (result: Ack<null>) => void) => void;
  "battle:forfeit": (input: BattleForfeitInput) => void;
}
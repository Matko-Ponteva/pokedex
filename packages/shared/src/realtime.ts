import { z } from "zod";
import type { PokemonSummary } from "./index.ts";

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

export interface ServerToClientEvents {
  "lobby:users": (users: OnlineUser[]) => void;
  "trade:offered": (offer: TradeOffer) => void;
  "trade:closed": (event: TradeClosed) => void;
}

export interface ClientToServerEvents {
  "lobby:join": (reply: (users: OnlineUser[]) => void) => void;
  "lobby:leave": () => void;
  "trade:offer": (input: TradeOfferInput, reply: (result: Ack<TradeOffer>) => void) => void;
  "trade:accept": (input: TradeAcceptInput, reply: (result: Ack<null>) => void) => void;
  "trade:decline": (input: TradeIdInput) => void;
  "trade:cancel": (input: TradeIdInput) => void;
}
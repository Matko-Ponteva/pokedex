import type { MemberRef, TradeOffer } from "@pokedex/shared";

export type PendingTrade = {
  offer: TradeOffer;
  fromMember: MemberRef;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingTrade>();

export function addTrade(
  offer: TradeOffer,
  fromMember: MemberRef,
  lifetimeMs: number,
  onExpire: () => void
): PendingTrade {
  const trade = { offer, fromMember, timer: setTimeout(onExpire, lifetimeMs) };
  pending.set(offer.id, trade);
  return trade;
}

export function getTrade(offerId: string): PendingTrade | undefined {
  return pending.get(offerId);
}

export function removeTrade(offerId: string) {
  const trade = pending.get(offerId);
  if (!trade) return;
  clearTimeout(trade.timer);
  pending.delete(offerId);
}

export function findOutgoing(userId: number): PendingTrade | undefined {
  return [...pending.values()].find((trade) => trade.offer.from.id === userId);
}

export function tradesInvolving(userId: number): PendingTrade[] {
  return [...pending.values()].filter(
    (trade) => trade.offer.from.id === userId || trade.offer.to.id === userId
  );
}
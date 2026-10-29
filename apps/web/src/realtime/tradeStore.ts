import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TradeClosed, TradeOffer } from "@pokedex/shared";
import { socket } from "./socket";

type Notice = TradeClosed & { key: number };
type TradeState = { trades: TradeOffer[]; notices: Notice[] };

let state: TradeState = { trades: [], notices: [] };
let nextKey = 1;
const listeners = new Set<() => void>();

function update(next: TradeState) {
  state = next;
  for (const listener of listeners) listener();
}

socket.on("trade:offered", (offer) => {
  update({ ...state, trades: [...state.trades.filter((t) => t.id !== offer.id), offer] });
});

socket.on("trade:closed", (event) => {
  update({
    trades: state.trades.filter((t) => t.id !== event.offerId),
    notices: [{ ...event, key: nextKey++ }, ...state.notices].slice(0, 5),
  });
});

socket.on("disconnect", () => {
  update({ trades: [], notices: [] });
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTradeState(): TradeState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useTradeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onClosed(event: TradeClosed) {
      if (event.reason !== "completed") return;
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["public-teams"] });
    }
    socket.on("trade:closed", onClosed);
    return () => {
      socket.off("trade:closed", onClosed);
    };
  }, [queryClient]);
}
import { randomUUID } from "node:crypto";
import {
  tradeAcceptInputSchema, tradeIdInputSchema, tradeOfferInputSchema,
  type OnlineUser, type TradeCloseReason, type TradeOffer,
} from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import { getOwnedMember, swapMembers } from "../services/tradeService.ts";
import { onlineUser } from "./presence.ts";
import {
  addTrade, findOutgoing, getTrade, removeTrade, tradesInvolving, type PendingTrade,
} from "./trades.ts";
import { userRoom, type AppServer, type AppSocket } from "./types.ts";
import { respond } from "./respond.ts";

const OFFER_LIFETIME_MS = 60_000;

function title(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replaceAll("-", " ");
}

function closeTrade(
  io: AppServer,
  trade: PendingTrade,
  reason: TradeCloseReason,
  messages: { from: string; to: string }
) {
  const offerId = trade.offer.id;
  removeTrade(offerId);
  io.to(userRoom(trade.offer.from.id)).emit("trade:closed", { offerId, reason, message: messages.from });
  io.to(userRoom(trade.offer.to.id)).emit("trade:closed", { offerId, reason, message: messages.to });
}

export function cancelTradesFor(io: AppServer, user: OnlineUser) {
  for (const trade of tradesInvolving(user.id)) {
    const isSender = trade.offer.from.id === user.id;
    closeTrade(io, trade, "unavailable", {
      from: isSender
        ? "Your offer was withdrawn because you went offline."
        : `${user.displayName} went offline before answering.`,
      to: isSender
        ? `${user.displayName} went offline, so their offer was withdrawn.`
        : "The offer was withdrawn because you went offline.",
    });
  }
}

export function registerTradeHandlers(io: AppServer, socket: AppSocket) {
  const me = socket.data.user;

  for (const trade of tradesInvolving(me.id)) {
    socket.emit("trade:offered", trade.offer);
  }

  socket.on("trade:offer", (input, reply) =>
    respond(reply, async () => {
      const { toUserId, teamId, slot } = tradeOfferInputSchema.parse(input);
      if (toUserId === me.id) throw new HttpError(400, "You can't trade with yourself");
      const recipient = onlineUser(toUserId);
      if (!recipient) throw new HttpError(400, "That trainer is no longer online");
      if (findOutgoing(me.id)) throw new HttpError(409, "You already have an open offer");

      const member = await getOwnedMember({ userId: me.id, teamId, slot });
      const offer: TradeOffer = {
        id: randomUUID(),
        from: me,
        to: recipient,
        pokemon: member.pokemon,
        teamName: member.teamName,
        expiresAt: new Date(Date.now() + OFFER_LIFETIME_MS).toISOString(),
      };

      const trade = addTrade(offer, { teamId, slot }, OFFER_LIFETIME_MS, () => {
        closeTrade(io, trade, "expired", {
          from: `${recipient.displayName} didn't answer in time.`,
          to: `The offer from ${me.displayName} expired.`,
        });
      });

      io.to(userRoom(me.id)).to(userRoom(recipient.id)).emit("trade:offered", offer);
      return offer;
    })
  );

  socket.on("trade:accept", (input, reply) =>
    respond(reply, async () => {
      const { offerId, teamId, slot } = tradeAcceptInputSchema.parse(input);
      const trade = getTrade(offerId);
      if (!trade || trade.offer.to.id !== me.id) {
        throw new HttpError(404, "This offer is no longer available");
      }
      removeTrade(offerId);

      try {
        const { aGot, bGot } = await swapMembers(
          { userId: trade.offer.from.id, ...trade.fromMember },
          { userId: me.id, teamId, slot }
        );
        closeTrade(io, trade, "completed", {
          from: `Trade with ${me.displayName} complete: you gave ${title(bGot.name)} and got ${title(aGot.name)}.`,
          to: `Trade with ${trade.offer.from.displayName} complete: you gave ${title(aGot.name)} and got ${title(bGot.name)}.`,
        });
        return null;
      } catch (error) {
        closeTrade(io, trade, "unavailable", {
          from: `The trade with ${me.displayName} couldn't be completed.`,
          to: `The trade with ${trade.offer.from.displayName} couldn't be completed.`,
        });
        throw error;
      }
    })
  );

  socket.on("trade:decline", (input) => {
    const parsed = tradeIdInputSchema.safeParse(input);
    const trade = parsed.success ? getTrade(parsed.data.offerId) : undefined;
    if (!trade || trade.offer.to.id !== me.id) return;
    closeTrade(io, trade, "declined", {
      from: `${me.displayName} declined your offer.`,
      to: "You declined the offer.",
    });
  });

  socket.on("trade:cancel", (input) => {
    const parsed = tradeIdInputSchema.safeParse(input);
    const trade = parsed.success ? getTrade(parsed.data.offerId) : undefined;
    if (!trade || trade.offer.from.id !== me.id) return;
    closeTrade(io, trade, "cancelled", {
      from: "You cancelled your offer.",
      to: `${me.displayName} cancelled their offer.`,
    });
  });
}